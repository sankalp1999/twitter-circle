const fs = require('fs')
const puppeteer = require('puppeteer')

const fetchTwitterUserId = async (twitterUsername, browser) => {
	let attempts = 2 // Number of attempts: initial + 1 retry
	twitterUsername = twitterUsername.twitterUsername
	for (let i = 0; i < attempts; i++) {
		const page = await browser.newPage()
		await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36')
		
		await page.setRequestInterception(true)
		page.on('request', (req) => {
			if (['stylesheet', 'image', 'font'].includes(req.resourceType())) {
				req.abort()
			} else {
				req.continue()
			}
		})
		try {
			await page.goto(`https://twitter.com/${twitterUsername}`, { waitUntil: 'networkidle0', timeout: 0 }) // Increase timeout
			await page.waitForSelector('script[type="application/ld+json"]', { timeout: 3000 }) // Wait for the specific script tag, up to 10 seconds
			const userId = await page.evaluate(() => {
				const scriptContent = document.evaluate('//script[@type="application/ld+json"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent
				const json = JSON.parse(scriptContent)
				return json.author ? json.author.identifier : null
			})

			console.log(`${twitterUsername}: ${userId}`)
			await page.close()
			return { twitterUsername: twitterUsername, userId }
		} catch (error) {
			console.error(`Attempt ${i + 1} failed for ${twitterUsername}: ${error.message}`)
			await page.close() // Close the page even if an error occurs
			if (i === attempts - 1) { // If it's the last attempt, return null ID
				return { twitterUsername: twitterUsername, userId: null } // Return null ID on final failure
			}
			// Otherwise, it will retry
		}
	}
}

const chunkArray = (array, size) => {
	const chunkedArr = []
	for (let i = 0; i < array.length; i += size) {
		chunkedArr.push(array.slice(i, i + size))
	}
	return chunkedArr
}

const processChunk = async (chunk, browser) => {
	const results = await Promise.allSettled(chunk.map(username => fetchTwitterUserId(username, browser)))
	return results.map(result => result.value || result.reason)
}

const filePath = 'pfp_dict.json'; // Assume this file contains an array of Twitter usernames

(async () => {
	try {
		const jsonString = fs.readFileSync(filePath, 'utf8')
		let usernames = JSON.parse(jsonString)
		usernames = usernames.slice(0, 350)
		
		// console.log(usernames)
		const chunks = chunkArray(usernames, 10) // Create chunks of up to 50 usernames
		let results = []

		for (const chunk of chunks) {
			console.log(`Processing a chunk of ${chunk.length} usernames...`)
			const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
			const chunkResults = await processChunk(chunk, browser)
			results = results.concat(chunkResults)
			await browser.close() // Close the browser after each chunk is processed
		}

		const resultsJson = JSON.stringify(results, null, 2)
		fs.writeFileSync('userId_dict.json', resultsJson, 'utf8')
		console.log('Successfully saved user IDs data to file.')
	} catch (err) {
		console.error('Error:', err)
	}
})()