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

const profileData = JSON.parse(fs.readFileSync('headContent_dict.json', 'utf8'))

// Create dictionaries for username to identifier and identifier to username mappings
const usernameToId = {}
const idToUsername = {}

profileData.forEach(profile => {

	const username = profile.twitterUsername
	if(profile.profileJsonLd === 'dne' || profile.profileJsonLd === null) {
		return
	} else {
		const id = profile.profileJsonLd.author.identifier
		usernameToId[username] = id
		idToUsername[id] = username
	}
})


console.log(Object.keys(idToUsername).length)

// Read the direct messages file
const dmData = JSON.parse(fs.readFileSync('twitter-archive/data/direct-messages.js', 'utf8').replace('window.YTD.direct_messages.part0 = ', ''))

// Process each conversation
const processedConversations = dmData.map(conversation => {
	const [a, b] = conversation.dmConversation.conversationId.split('-')
	const recipientId = a === accountId ? b : a
	// console.log(recipientId, idToUsername[recipientId])
	const messages = conversation.dmConversation.messages
	const firstMessage = messages[0].messageCreate
	const lastMessage = messages[messages.length - 1].messageCreate

	return {
		conversationId: conversation.dmConversation.conversationId,
		recipientId: recipientId,
		recipientUsername: idToUsername[recipientId],
		firstMessage: {
			id: firstMessage.id,
			text: firstMessage.text,
			createdAt: firstMessage.createdAt
		},
		lastMessage: {  
			id: lastMessage.id,
			text: lastMessage.text, 
			createdAt: lastMessage.createdAt
		},
		numMessages : messages.length
	}
})

const sortedConversations = processedConversations.sort((a, b) => b.numMessages - a.numMessages)

console.log(sortedConversations)

// New aggregation logic, keeping processedConversations intact
const recipientAggregates = dmData.reduce((acc, conversation) => {
	const messages = conversation.dmConversation.messages
	const [a, b] = conversation.dmConversation.conversationId.split('-')
	const recipientId = a === accountId ? b : a
	const recipientUsername = idToUsername[recipientId]

	if (!acc[recipientId]) {
		acc[recipientId] = { totalConversations: 0, totalMessages: 0, imageSrc: null, lastMessage: null, recipientUsername: recipientUsername }
	}

	acc[recipientId].totalConversations += 1
	acc[recipientId].totalMessages += messages.length

	// Determine the last message for this recipient
	const lastMessageInConversation = messages.reduce((latest, current) => {
		const currentCreatedAt = new Date(current.messageCreate.createdAt)
		if (!latest || currentCreatedAt > new Date(latest.createdAt)) {
			return { text: current.messageCreate.text, createdAt: current.messageCreate.createdAt }
		}
		return latest
	}, acc[recipientId].lastMessage)

	if (!acc[recipientId].lastMessage || new Date(lastMessageInConversation.createdAt) > new Date(acc[recipientId].lastMessage.createdAt)) {
		acc[recipientId].lastMessage = lastMessageInConversation
	}

	return acc
}, {})

// Fetch imageSrc for each recipientId
Object.keys(recipientAggregates).forEach(recipientId => {
	const username = idToUsername[recipientId]
	const profile = profileData.find(p => p.twitterUsername === username)
	if (profile && profile.profileJsonLd && profile.profileJsonLd.author && profile.profileJsonLd.author.image) {
		recipientAggregates[recipientId].imageSrc = profile.profileJsonLd.author.image.contentUrl
	} else {
		// Use getPokemonImageUrl() if no imageSrc is found
		recipientAggregates[recipientId].imageSrc = getPokemonImageUrl()
	}
})

// Convert the aggregated object into an array, sort it, and include imageSrc and lastMessage
const sortedRecipientAggregates = Object.entries(recipientAggregates).map(([recipientId, stats]) => ({
	recipientId,
	...stats
})).sort((a, b) => b.totalMessages - a.totalMessages) // Sort by totalMessages, adjust as needed

console.log(sortedRecipientAggregates)

// Save the sorted data to dm_stats.json
const resultsJson = JSON.stringify(sortedRecipientAggregates, null, 2)
fs.writeFileSync('dm_stats.json', resultsJson, 'utf8')

// Define your current time, decay exponent, and linear coefficient outside the loop
const currentTime = new Date()
const decayExponent = 0.5 // Adjust based on desired decay of older interactions
const linearCoefficient = 0.05

profileData.forEach(profile => {
	let totalWeight = 0 // Initialize total weight for each profile

	// Loop through all sorted conversations to find matches
	sortedConversations.forEach(convo => {
		if (convo.recipientUsername === profile.twitterUsername) {
			// Calculate the time difference from the last message
			const lastMessageDate = new Date(convo.lastMessage.createdAt)
			const timeDiff = Math.max((currentTime - lastMessageDate) / (1000 * 60 * 60 * 24), 0) // Time difference in days
            
			// Calculate the time weight using the decay factor
			const timeWeight = 1 / (Math.pow(timeDiff + 1, decayExponent) + linearCoefficient * timeDiff)
            
			// Update total weight for this profile based on the message count and time weight
			totalWeight += (convo.numMessages / 20) * timeWeight
		}
	})

	// Update the profile's weight with the total weight calculated from matching conversations
	if (!profile.weight) {
		profile.weight = 0 // Initialize if it doesn't exist
	}
	profile.weight += totalWeight
})


const extractedData = profileData.map(profile => {
	
	let imageSrc = profile.profileJsonLd && profile.profileJsonLd.author && profile.profileJsonLd.author.image ? profile.profileJsonLd.author.image.contentUrl : null

	// If imageSrc is null, use getPokemonImageUrl() to fetch an image
	if (!imageSrc) {
		imageSrc = getPokemonImageUrl()
	}

	return {
		twitterUsername: profile.twitterUsername,
		imageSrc: imageSrc, // This will now either be the original, or fetched if null
		weight: profile.weight || 0, // Provide a default value if weight is missing
		identifier: profile.profileJsonLd && profile.profileJsonLd.author ? profile.profileJsonLd.author.identifier : null
	}
})

extractedData.sort((a, b) => b.weight - a.weight)

// Save the updated profileData back to the file
const updatedProfileDataJson = JSON.stringify(extractedData, null, 2)
fs.writeFileSync('final_weights.json', updatedProfileDataJson, 'utf8')
