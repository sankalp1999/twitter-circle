const fs = require('fs')



const startYear = new Date().getFullYear() - 4 // Assuming the same 5-year range as before

// Function to generate month-years, same as before
function generateMonthYears(startYear) {
	let monthYears = []
	for (let year = startYear; year < startYear + 5; year++) {
		for (let month = 1; month <= 12; month++) {
			monthYears.push(`${month}-${year}`)
		}
	}
	return monthYears
}

// Generate month-year labels for the entire 5-year period
const allMonthYears = generateMonthYears(startYear)

// Function to process conversations and populate message counts
function processConversations(allData) {
	// Initialize an object to hold message counts per month-year
	const countsPerMonthYear = allMonthYears.reduce((acc, monthYear) => {
		acc[monthYear] = 0 // Initialize all months with 0 messages
		return acc
	}, {})

	// Filter conversations to include only those with specificId in conversationId
	// const filteredConversations = conversations.filter(conv => conv.conversationId.includes(specificId))


	const filteredConversations = allData.filter(conv => {
		// Debugging: Log the structure of a conversation object
		console.log('here', conv)
		console.log('end')
		// Adjust the property access according to the actual structure
		// For example, if conversationId is directly accessible and a string
		return conv.dmConversation && conv.dmConversation.conversationId && typeof conv.dmConversation.conversationId === 'string' && conv.dmConversation.conversationId.includes(specificId)
		// If the structure is different, adjust the above condition accordingly
	})
    
	console.log(filteredConversations)

	// Populate the message counts for each filtered conversation
	filteredConversations.forEach(conversation => {
		conversation.dmConversation.messages.forEach(msg => {
			const date = new Date(msg.messageCreate.createdAt)
			const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`

			if (countsPerMonthYear.hasOwnProperty(monthYear)) {
				countsPerMonthYear[monthYear]++
			}
		})
	})

	return countsPerMonthYear
}


const allData = JSON.parse(fs.readFileSync('twitter-archive/data/direct-messages.js', 'utf8').replace('window.YTD.direct_messages.part0 = ', ''))

// Assuming allData is an array of conversation objects
const countsPerMonthYear = processConversations(allData)

fs.writeFileSync('dm_counts.json', JSON.stringify(countsPerMonthYear, null, 2))

const specificId = '1606638641857630211' // Example ID you are looking for in conversationIds