const fs = require('fs')


const getPokemonImageUrl = () => {
	const baseUrl = 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/'
	const pokemonNumber = Math.floor(Math.random() * 1000)
	const paddedNumber = pokemonNumber.toString().padStart(3, '0')
	return  `${baseUrl}${paddedNumber}.png`
}


// thanks chatgpt
function generateMonthYears() {
	let monthYears = []
	const endDate = new Date() // Current date
	const startDate = new Date(new Date().setFullYear(endDate.getFullYear() - 5)) // 5 years before

	let currentYear = endDate.getFullYear()
	let currentMonth = endDate.getMonth() + 1 // JS months are 0-indexed, add 1 for human-readable format

	while (currentYear > startDate.getFullYear() || (currentYear === startDate.getFullYear() && currentMonth >= startDate.getMonth() + 1)) {
		// Prepend to keep the list in descending order from the current month-year
		monthYears.unshift(`${currentMonth}-${currentYear}`)

		// Move to the previous month
		if (currentMonth === 1) {
			currentMonth = 12 // Wrap around to December of the previous year
			currentYear-- // Decrement the year
		} else {
			currentMonth-- // Just go to the previous month
		}
	}

	return monthYears
}


const allMonthYears = generateMonthYears()

// Function to process conversations and populate message counts
function processConversations(allData, recipientUserId, recipientUsername, imageSrc, lastMessage, lastMessageDate, totalMsgCount, messagesSent, messagesReceived) {
	// Initialize an object to hold message counts per month-year

    

	const countsPerMonthYear = allMonthYears.reduce((acc, monthYear) => {
		acc[monthYear] = 0 // Initialize all months with 0 messages
		return acc
	}, {})

	// Filter conversations to include only those with specificId in conversationId
	// const filteredConversations = conversations.filter(conv => conv.conversationId.includes(specificId))


	const filteredConversations = allData.filter(conv => {
		// Debugging: Log the structure of a conversation object
		
		// Adjust the property access according to the actual structure
		// For example, if conversationId is directly accessible and a string
		return conv.dmConversation && conv.dmConversation.conversationId && typeof conv.dmConversation.conversationId === 'string' && conv.dmConversation.conversationId.includes(recipientUserId)
		// If the structure is different, adjust the above condition accordingly
	})
    

	// Populate the message counts for each filtered conversation
	filteredConversations.forEach(conversation => {
		conversation.dmConversation.messages.forEach(msg => {
			const date = new Date(msg.messageCreate?.createdAt)
			const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`

			if (countsPerMonthYear.hasOwnProperty(monthYear)) {
				countsPerMonthYear[monthYear]++
			}
		})
	})

	return {
		recipientUserId,
		recipientUsername,
		countsPerMonthYear,
		imageSrc,
		lastMessage,
		lastMessageDate,
		totalMsgCount,
		messagesSent,
		messagesReceived
	}
}


const directMessagesDataRaw = fs.readFileSync('twitter-archive/data/direct-messages.js', 'utf8')
const directMessagesData = JSON.parse(directMessagesDataRaw.replace('window.YTD.direct_messages.part0 = ', ''))


const user_mentions_dict = fs.readFileSync('user_mentions_screen_name_mapping.json', 'utf8')
const userMentionsDict = JSON.parse(user_mentions_dict)
		

const updatedScreenNameToId = userMentionsDict.screenNameToId
const updatedIdToScreenName = userMentionsDict.idToScreenName

// Iterate through dmStats and process each conversation
const dmStats = JSON.parse(fs.readFileSync('dm_sorted_by_message_count_and_last_message.json', 'utf8'))


const results = dmStats.map(conv => {
	const recipientId = conv.recipientId // Assuming dmStats has a recipientId field
	const lastMessage = conv.lastMessage.text
	const lastMessageDate = new Date(conv.lastMessage.createdAt)
	const twitterUsername = updatedIdToScreenName[recipientId]?.twitterUsername
	let imageSrc = updatedIdToScreenName[recipientId]?.imageSrc
	const totalMsgCount = conv.totalMessages
	const messagesSent = conv.messagesSent
	const messagesReceived = conv.messagesReceived

	let recipientUsername = conv.recipientUsername ? conv.recipientUsername : twitterUsername

	if (!imageSrc && recipientUsername) {
		imageSrc = updatedScreenNameToId[recipientUsername]?.imageSrc
		
	}

	if (!recipientUsername) {
		recipientUsername = 'not_found'.concat(recipientId)
	}

	if (!imageSrc) {
		imageSrc = getPokemonImageUrl()
	}

	return processConversations(directMessagesData, recipientId, recipientUsername, imageSrc, lastMessage, lastMessageDate, totalMsgCount, messagesSent, messagesReceived)
})

fs.writeFileSync('dm_final_stats_with_chart.json', JSON.stringify(results, null, 2))
