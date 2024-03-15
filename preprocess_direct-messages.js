const fs = require('fs')

const getPokemonImageUrl = () => {
	const baseUrl = 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/'
	const pokemonNumber = Math.floor(Math.random() * 1000)
	// Convert to string and pad with zeros to ensure it is three digits
	const paddedNumber = pokemonNumber.toString().padStart(3, '0')
	return  `${baseUrl}${paddedNumber}.png`
}

// Read the file and remove the JavaScript assignment prefix
const userDetails = JSON.parse(fs.readFileSync('twitter-archive/data/account.js', 'utf8').replace('window.YTD.account.part0 = ', ''))

const [accountWrapper] = userDetails 
const account = accountWrapper.account 
const userName = account.username 
const accountId = account.accountId 

console.log(`Username: ${userName}, Account ID: ${accountId}`)

const userMentionsMapping = JSON.parse(fs.readFileSync('user_mentions_screen_name_mapping.json', 'utf8'))

// Extract the screenNameToId and idToScreenName mappings
const usernameToId = userMentionsMapping.screenNameToId
const idToUsername = userMentionsMapping.idToScreenName


console.log(Object.keys(idToUsername).length)

// Read the direct messages file
const dmData = JSON.parse(fs.readFileSync('twitter-archive/data/direct-messages.js', 'utf8').replace('window.YTD.direct_messages.part0 = ', ''))

const noMapping = []

// dm side, only id data
// no username
const processedConversations = dmData.map(conversation => {
	const [a, b] = conversation.dmConversation.conversationId.split('-')
	const recipientId = a === accountId ? b : a
	// console.log(recipientId, idToUsername[recipientId])
	const messages = conversation.dmConversation.messages

	if (messages && messages.length === 0) return null


	const firstMessage = messages[0].messageCreate
	const lastMessage = messages[messages.length - 1].messageCreate

	if (!idToUsername[recipientId]) {
		noMapping.push(recipientId)
	}

	return {
		conversationId: conversation.dmConversation.conversationId,
		recipientId: recipientId,
		recipientUsername: idToUsername[recipientId],
		firstMessage: {
			id: firstMessage?.id,
			text: firstMessage?.text,
			createdAt: firstMessage?.createdAt
		},
		lastMessage: {  
			id: lastMessage?.id,
			text: lastMessage?.text, 
			createdAt: lastMessage?.createdAt
		},
		numMessages : messages.length
	}
}).filter(item => item !== null)


// IMPORTANT
const sortedConversations = processedConversations
	.filter(({ numMessages }) => numMessages != null && !isNaN(numMessages))
	.sort((a, b) => b.numMessages - a.numMessages)


console.log(sortedConversations)

// New aggregation logic, keeping processedConversations intact
// saved as dm_sorted_by_message_count_and_last_message
const recipientAggregates = dmData.reduce((acc, conversation) => {
	const messages = conversation.dmConversation.messages
	const [a, b] = conversation.dmConversation.conversationId.split('-')
	const recipientId = a === accountId ? b : a

	if (!recipientId) {
		console.log('Missing recipientId')
		return acc // Continue to the next iteration without making changes
	}
	
	const recipientUsername = idToUsername[recipientId] || `Unknown User ${recipientId}`


	if (!acc[recipientId]) {
		acc[recipientId] = { 
			totalConversations: 0, 
			totalMessages: 0, 
			messagesSent: 0, 
			messagesReceived: 0, 
			imageSrc: null, 
			lastMessage: null, 
			recipientUsername: recipientUsername 
		}
	}

	acc[recipientId].totalConversations += 1
	acc[recipientId].totalMessages += messages.length

	// only goes through messages of that convo
	messages.forEach(message => {
		if (message.messageCreate?.senderId === accountId) {
			acc[recipientId].messagesSent += 1
		} else {
			acc[recipientId].messagesReceived += 1
		}
	})

	// Determine the last message for this recipient
	const lastMessageInConversation = messages.reduce((latest, current) => {
		if (!current || !current.messageCreate) {
			console.log('skipping message due to current being null/undefined or missing messageCreate')
			return latest // Skip if no messageCreate property
		}
		const currentCreatedAt = new Date(current.messageCreate?.createdAt)

		if (isNaN(currentCreatedAt.getTime())) {
			return latest // Skip if createdAt is not a valid date
		}

		if (!latest || currentCreatedAt > new Date(latest.createdAt)) {
			return { text: current.messageCreate.text || '', createdAt: current.messageCreate.createdAt }
		}
		return latest
	}, acc[recipientId].lastMessage)

	if (!acc[recipientId].lastMessage || new Date(lastMessageInConversation.createdAt) > new Date(acc[recipientId].lastMessage.createdAt)) {
		acc[recipientId].lastMessage = lastMessageInConversation
	}

	return acc
}, {})



// Convert the aggregated object into an array, sort it, and include imageSrc and lastMessage
const sortedRecipientAggregates = Object.entries(recipientAggregates).map(([recipientId, stats]) => ({
	recipientId,
	...stats
})).filter(item => item.totalMessages !== null && item.totalMessages !== undefined && !isNaN(item.totalMessages))
	.sort((a, b) => b.totalMessages - a.totalMessages)

console.log(sortedRecipientAggregates)

// Save the sorted data to dm_sorted_by_message_count_and_last_message
const resultsJson = JSON.stringify(sortedRecipientAggregates, null, 2)
fs.writeFileSync('dm_sorted_by_message_count_and_last_message.json', resultsJson, 'utf8')

// current time, decay exponent, and linear coefficient outside the loop
const currentTime = new Date()
const decayExponent = 0.5 // Adjust based on desired decay of older interactions
const linearCoefficient = 0.05

// total weights for each recipient
const recipientWeights = {}

// we use sortedConversations for weights because latest timestamp
sortedConversations.forEach(convo => {
	// Calculate the time difference from the last message
	const lastMessageDate = new Date(convo.lastMessage.createdAt)
	const timeDiff = Math.max((currentTime - lastMessageDate) / (1000 * 60 * 60 * 24), 0) // Time difference in days

	// Calculate the time weight using the decay factor
	const timeWeight = 1 / (Math.pow(timeDiff + 1, decayExponent) + linearCoefficient * timeDiff)

	// Calculate the weight for this conversation
	const convoWeight = (convo.numMessages / 20) * timeWeight

	if (recipientWeights[convo.recipientId]) { 
		recipientWeights[convo.recipientId].weight += convoWeight // change from convo.recipientUsername to convo.recipientId
	} else {
		recipientWeights[convo.recipientId] = { weight: convoWeight, twitterUsername: convo.recipientUsername } // change from convo.recipientUsername to convo.recipientId
	}
})

const sortedArray = Object.entries(recipientWeights)
	.filter(([, value]) => value.weight !== null && value.weight !== undefined && !isNaN(value.weight))
	.sort((a, b) => {
		return b[1].weight - a[1].weight
	})

console.log(sortedArray.length)
// Save the updated profileData back to the file
const recipientWeightsJson = JSON.stringify(sortedArray, null, 2)
fs.writeFileSync('sortedDmWeights.json', recipientWeightsJson, 'utf8')

// Final weight computation below this region

const mentionsDataRaw = fs.readFileSync('mentions_count_folder/mentionsCountWeighted.json', 'utf8')
const mentionsData = JSON.parse(mentionsDataRaw)

let idx = 0 
Object.entries(mentionsData).forEach(([username, {count, id}]) => {

	// they are null because we don't have the userid to username mapping which relies on having atleast one mention (you have to reply)
	// edge case is if we don't have id (i.e they haven't replied on TL) and they talked a lot in DM
	idx += 1
	if (id === null) {
		const new_name = 'notfound'.concat(username)
		recipientWeights[new_name] = { weight: count, twitterUsername : username }
	} else if (recipientWeights[id]) {
		recipientWeights[id].weight += count 
	} else {
		recipientWeights[id] = { weight: count, twitterUsername : username }
	}
})


const reSortedArray = Object.entries(recipientWeights)
	.filter(([, value]) => value.weight != null && !isNaN(value.weight))
	.sort((a, b) => {
		return b[1].weight - a[1].weight 
	})


const reSortedJson = JSON.stringify(reSortedArray, null, 2)
fs.writeFileSync('sortedCombinedWeights.json', reSortedJson, 'utf8')

console.log(noMapping.length)

