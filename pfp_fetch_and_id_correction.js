/* eslint-disable no-mixed-spaces-and-tabs */
const fs = require('fs')
const puppeteer = require('puppeteer')
const isReachable = require('is-reachable')

const getPokemonImageUrl = () => {
	const baseUrl = 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/'
	let pokemonNumber
	// repeating random number generation if we get 54 as the result
	// cause we are using this pokemon number as a fallback image 
	// when image src URL fails to fetch the image
	do {
		pokemonNumber = Math.floor(Math.random() * 1000)
	} while (pokemonNumber === 54)
	const paddedNumber = pokemonNumber.toString().padStart(3, '0')
	return  `${baseUrl}${paddedNumber}.png`
}


// const fetchAvatarFromTwitter = async (page, twitterUsername) => {
// 	await page.goto(`https://twitter.com/${twitterUsername}/photo`, { waitUntil: 'domcontentloaded' })
// 	const title = await page.evaluate(() => document.querySelector('title')?.innerText)
// 	const textExists = await page.evaluate(() => document.body.textContent.includes('This account doesn’t exist'))

// 	if (textExists || title === 'Profile / X') {
// 		console.log('Account does not exist, skipping')
// 		return null
// 	}

// 	await page.waitForSelector('img[alt="Image"][draggable="true"]', { timeout: 10000 })
// 	const imageSrc = await page.evaluate(() => {
// 		const image = document.querySelector('img[alt="Image"][draggable="true"]')
// 		return image ? image.src : null
// 	})
// 	return imageSrc
// }

const fetchAvatarFromSotwe = async (page, twitterUsername, id) => {
	await page.goto(`https://sotwe.com/${twitterUsername}`, { waitUntil: 'networkidle2' })
	const title = await page.evaluate(() => document.querySelector('title')?.innerText)

	if (title === 'Twitter Web Viewer & Trend Analyzer & Downloader | Sotwe') {
		console.log('Account does not exist, skipping')
		return { imageSrc: null, bannerSrc: null }
	}


	await page.waitForSelector(`img[alt="${twitterUsername}'s profile image"]`, { timeout: 10000 })
	const imageSrc = await page.evaluate((twitterUsername) => {
		const image = document.querySelector(`img[alt="${twitterUsername}'s profile image"]`)
		return image ? image.src : null
	}, twitterUsername)

	if(imageSrc && imageSrc.startsWith('data:image')) {
		throw new Error(`Image source for ${twitterUsername} is a data URL, not a link. Retrying`)
	}

	let bannerSrc = 'already_exists'
	if (id.includes('notfound')) {
		await page.waitForSelector(`img[alt="${twitterUsername}'s profile banner image"]`, { timeout: 10000 })
		bannerSrc = await page.evaluate((twitterUsername) => {
			const image = document.querySelector(`img[alt="${twitterUsername}'s profile banner image"]`)
			return image ? image.src : null
		}, twitterUsername)
	}

	return { imageSrc, bannerSrc }
}

const fetchAvatarFromTwstalker = async (page, twitterUsername, id) => {

	await page.goto(`https://twstalker.com/${twitterUsername}`, { waitUntil: 'domcontentloaded' }, {timeout: 5000})

	// I don't want to retry so skip accounts do not exist using simple logic
	const areAllCountsZero = await page.evaluate(() => {
		const numbrElements = Array.from(document.querySelectorAll('.dscun-numbr'))
		return numbrElements.every(element => parseInt(element.textContent.replace('K', '000')) === 0)
			  })
	

	if(areAllCountsZero) {
		console.log(`Account does not exist or deactivated: ${twitterUsername}`)
		return {twitterUsername: twitterUsername, imageSrc: getPokemonImageUrl(), bannerSrc: null,  id: id}
	}

	await page.waitForSelector('a.thumbnail img.img-thumbnail', {timeout: 5000}) 
	let imageSrc = await page.$eval('a.thumbnail img.img-thumbnail', img => img.src)
	

	let bannerSrc = 'already_exists'
	if (id.includes('notfound')) {
		bannerSrc = await page.evaluate(() => {
			const element = document.querySelector('.todo-thumb1.dash-bg-image1.dash-bg-overlay')
			// Extract the URL part from the `background-image` CSS property
			const style = window.getComputedStyle(element)
			const bgImage = style.backgroundImage // e.g., url("http://example.com/image.jpg")
			return bgImage.replace(/url\(["']?(.*?)["']?\)/, '$1') // Remove url("...") wrapper
		  })
	}

	return { imageSrc, bannerSrc }
}

const fetchAvatarInstalkerOrg = async (page, twitterUsername, id) => {

	await page.goto(`https://instalker.org/${twitterUsername}`, { waitUntil: 'domcontentloaded' }, {timeout: 5000})

	// I don't want to retry so skip accounts do not exist using simple logic
	const areAllCountsZero = await page.evaluate(() => {
		const numbrElements = Array.from(document.querySelectorAll('.dscun-numbr'))
		return numbrElements.every(element => parseInt(element.textContent.replace('K', '000')) === 0)
			  })
	

	if(areAllCountsZero) {
		console.log(`Account does not exist or deactivated: ${twitterUsername}`)
		return {twitterUsername: twitterUsername, imageSrc: getPokemonImageUrl(), bannerSrc: null,  id: id}
	}

	await page.waitForSelector('img[src^="https://pbs.twimg.com/profile_images"]')

	const imageSrc = await page.$eval('img[src^="https://pbs.twimg.com/profile_images"]', img => img.src)	

	let bannerSrc = 'already_exists'
	if (id.includes('notfound')) {
		bannerSrc = await page.evaluate(() => {
			const element = document.querySelector('.todo-thumb1.dash-bg-image1.dash-bg-overlay')
			// Extract the URL part from the `background-image` CSS property
			const style = window.getComputedStyle(element)
			const bgImage = style.backgroundImage // e.g., url("http://example.com/image.jpg")
			return bgImage.replace(/url\(["']?(.*?)["']?\)/, '$1') // Remove url("...") wrapper
		  })
	}

	return { imageSrc, bannerSrc }
}

const getAvatar = async (id, twitterUsername, browser, weight, isReachablePrimary) => {
	let attempts = 2
	for (let i = 0; i < attempts; i++) {
		const page = await browser.newPage()
		await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36')
		try {
			let result
			// sotwe keeps image for deactivated accounts too hence using it first
			if (isReachablePrimary) {
				let { imageSrc, bannerSrc } = await fetchAvatarFromTwstalker(page, twitterUsername, id)
				
				if(!imageSrc) {
					console.log('null image possibily line 150', imageSrc)
					imageSrc = getPokemonImageUrl()
				}
				
				result = {twitterUsername, imageSrc, bannerSrc, weight, id}

			} else {
				let { imageSrc, bannerSrc } = await fetchAvatarInstalkerOrg(page, twitterUsername, id)

				if(!imageSrc) {
					console.log('null image possibily line 160', imageSrc)
					imageSrc = getPokemonImageUrl()
				}
				result = {twitterUsername, imageSrc, bannerSrc, weight, id}
			}
			console.log(`${twitterUsername}: ${result.imageSrc}`)
			return result
		} catch (error) {
			console.error(`Attempt ${i + 1} failed for ${twitterUsername}: ${error.message}`)
			if (i === attempts - 1) {
				return {twitterUsername, imageSrc: getPokemonImageUrl(), bannerSrc: null, weight, id}
			}
		} finally {
			await page.close()
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
	const primaryWebsite = 'twstalker.com'
	const isReachablePrimary = await isReachable(primaryWebsite)
	isReachablePrimary ? console.log('fetching from twstalker') : console.log('instalk')
	return await Promise.all(chunk.map(([id, { twitterUsername, weight }]) => getAvatar(id, twitterUsername, browser, weight, isReachablePrimary)))
}

const filePath = 'sortedCombinedWeights.json';

(async () => {
	try {
		const jsonString = fs.readFileSync(filePath, 'utf8')
		const data = JSON.parse(jsonString)
		
		// can adjust this
		const topN = 250
		const entries = data.slice(0, topN) // Use directly, assuming your data structure
		const remainingEntries = data.slice(topN)

		const chunks = chunkArray(entries, 50)
		let results = []
  
		for (const chunk of chunks) {
			console.log(`Processing a chunk of ${chunk.length} entries...`)
			const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
			const chunkResults = await processChunk(chunk, browser)
			results = results.concat(chunkResults)
			await browser.close()
		}
        
		const user_mentions_dict = fs.readFileSync('user_mentions_screen_name_mapping.json', 'utf8')
		const userMentionsDict = JSON.parse(user_mentions_dict)
		
		// update missing username and id
		const screenNameToId = userMentionsDict.screenNameToId
		const idToScreenName = userMentionsDict.idToScreenName

		let updatedScreenNameToId = {}
		let updatedIdToScreenName = {}

		results.forEach(result => {
			const { twitterUsername, id, imageSrc } = result // Extract necessary details from each result.
			
			// Update the mapping with a new structure.
			updatedScreenNameToId[twitterUsername] = { id, imageSrc }
			updatedIdToScreenName[id] = { twitterUsername, imageSrc }
		})
		

		remainingEntries.forEach(([id, { twitterUsername, weight }]) => {
			console.log("Line 237, remaining entries", id, twitterUsername, weight)
			results.push({twitterUsername: twitterUsername, imageSrc: getPokemonImageUrl(), weight: weight, id: id})
		})
		

		// PFP FETCH IS DONE
		// BELOW THIS POINT IS TO FIX MISSING ACCOUNT IDS
		

		// add remaining weight
		const sortedDmWeightsRaw = fs.readFileSync('sortedDmWeights.json', 'utf8')
		const sortedDmWeightsArray = JSON.parse(sortedDmWeightsRaw)
		const sortedDmWeightsLookup = sortedDmWeightsArray.reduce((acc, [id, { weight }]) => {
			acc[id] = weight // Assign weight to the id key
			return acc
		}, {})

		
		// results.forEach((result) => {

		// 	console.log('ENTERING PFP CORRECTION LINE 256')

		// 	if (result.id.includes('notfound')) {
		// 		const regexPattern = 'profile_banners\\/([^\\/]+)'
		// 		const regex = new RegExp(regexPattern)
		// 		const match = result.bannerSrc ? result.bannerSrc.match(regex) : null
		// 		console.log('not found if block LINE 264', match)
		// 		if (match) {
		// 			result.id = match[1] 

		// 			updatedScreenNameToId[result.twitterUsername] = { id: result.id, imageSrc: result.imageSrc } // Map username to ID
        //    			updatedIdToScreenName[result.id] = { twitterUsername: result.twitterUsername, imageSrc: result.imageSrc }
		// 			console.log(result.id, result.twitterUsername)

		// 			// since earlier we added only mentionsCountWeighted count for this
		// 			// lookup the new weight and add it to result.weight if the id is found in sortedDmWeightsLookup
		// 			const additionalWeight = sortedDmWeightsLookup[result.id]
		// 			if (additionalWeight) {
		// 				result.weight += additionalWeight
		// 			}
		// 		} else {
		// 			// If not fetching banner, then we don't have their username too

		// 			// console.log(`${result.twitterUsername} No ID found in bannerSrc`)
		// 			// Handle the case where no match is found, if necessary
		// 		}
		// 	}
		// })

		fs.writeFileSync('user_mentions_screen_name_mapping.json', JSON.stringify({screenNameToId: updatedScreenNameToId, idToScreenName: updatedIdToScreenName}, null, 2), 'utf8', (err) => {
			if (err) {
			  console.error('An error occurred while writing the JSON to the file:', err)
			} else {
			  console.log('Successfully updated and saved the screen_name to id lookup with new data.')
			}
		  })

		
		  results.sort((a, b) => {
			const weightA = a.weight ?? 0;
			const weightB = b.weight ?? 0;
			return weightB - weightA;
		  });

		const resultsJson = JSON.stringify(results, null, 2)
		fs.writeFileSync('final_weights_with_pics.json', resultsJson, 'utf8')

		console.log('Successfully saved profile images data to file.')
	} catch (err) {
		console.error('Error:', err)
	}
})()
