const fs = require('fs')
const puppeteer = require('puppeteer')

const fetchTwitterProfileJsonLd = async (twitterUsername, browser) => {
	twitterUsername = twitterUsername.twitterUsername
	const imgSrc = twitterUsername.imageSrc


	if (imgSrc === null) {
		console.log(`Profile not accessible or does not exist for ${twitterUsername}`)
		return { twitterUsername: twitterUsername, profileJsonLd: 'dne' }
	}


	const page = await browser.newPage()
	await page.setRequestInterception(false)
	await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36')
	
	await page.setRequestInterception(true)

	// Add event listener to abort requests for stylesheets, images, and fonts
	page.on('request', (request) => {
		const resourceType = request.resourceType()
		if (['stylesheet', 'image', 'font'].includes(resourceType)) {
			request.abort()
		} else {
			request.continue()
		}
	})

	try {
		// Set a maximum duration for each request
		const maxDuration = 5000 // 15 seconds

		// go to the with_replies page to avoid redirect issue
		await page.goto(`https://twitter.com/${twitterUsername}/with_replies`, { waitUntil: 'networkidle2' })


		const currentUrl = page.url()
		// Immediately check the page title from the head section
		const title = await page.evaluate(() => document.querySelector('title')?.innerText)
		const textExists = await page.evaluate(() => {
			return document.body.textContent.includes('This account doesn’t exist')
		})

		// If the title indicates a non-accessible profile, return null for profileJsonLd
		if (textExists || title === 'Profile / X' || title === 'Log in to X / X' || currentUrl.includes('redirect_after_login')) {
			console.log(`Profile not accessible or does not exist for ${twitterUsername}`)
			if (title === 'Log in to X / X' || currentUrl.includes('redirect_after_login')) {
				return { twitterUsername: twitterUsername, profileJsonLd: 'redirect_case'}
			}
			return { twitterUsername: twitterUsername, profileJsonLd: 'dne' }
		}

		// Wait for the JSON-LD script tag and extract content
		const jsonLdContent = await page.waitForSelector('script[type="application/ld+json"]', { timeout: maxDuration })
			.then(() => page.evaluate(() => {
				const scriptElement = document.querySelector('script[type="application/ld+json"]')
				return scriptElement ? JSON.parse(scriptElement.innerText) : null
			}))

		console.log(`JSON-LD content fetched for ${twitterUsername}`)
		return { twitterUsername: twitterUsername, profileJsonLd: jsonLdContent }
	} catch (error) {
		console.error(`Error fetching JSON-LD content for ${twitterUsername}: ${error.message}`)
		return { twitterUsername: twitterUsername, profileJsonLd: null }
	} finally {
		await page.close()
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
	return await Promise.allSettled(chunk.map(username => 
		fetchTwitterProfileJsonLd(username, browser)
	)).then(results => results.map((result, index) => result.status === 'fulfilled' ? result.value : { 
		twitterUsername: chunk[index], 
		profileJsonLd: null
	}))
}


const filePath = 'pfp_dict.json'; // This file should contain an array of Twitter usernames

(async () => {
	try {
		const jsonString = fs.readFileSync(filePath, 'utf8')
		let usernames = JSON.parse(jsonString)
		usernames = usernames.slice(0, 500)
		const chunks = chunkArray(usernames, 10) // Adjust chunk size as needed
		let results = []

		for (const chunk of chunks) {
			const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
			console.log(`Processing a chunk of ${chunk.length} usernames...`)
			const chunkResults = await processChunk(chunk, browser)
			results = results.concat(chunkResults)
			await browser.close() 

		}

		const resultsJson = JSON.stringify(results, null, 2)
		fs.writeFileSync('headContent_dict.json', resultsJson, 'utf8')
		console.log('Successfully saved head content data to file.')
	} catch (err) {
		console.error('Error:', err)
	}
})()