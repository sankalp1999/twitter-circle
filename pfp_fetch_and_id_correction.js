/* eslint-disable no-mixed-spaces-and-tabs */
const fs = require('fs')
const puppeteer = require('puppeteer')

const getPokemonImageUrl = () => {
	const baseUrl = 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/'
	const pokemonNumber = Math.floor(Math.random() * 1000)
	const paddedNumber = pokemonNumber.toString().padStart(3, '0')
	return  `${baseUrl}${paddedNumber}.png`
}

const getAvatar = async (id, twitterUsername, browser, weight) => {
	let attempts = 3
	for (let i = 0; i < attempts; i++) {
		const page = await browser.newPage()
		await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36')
		try {

			// await page.goto(`https://twitter.com/${twitterUsername}/photo`, { waitUntil: 'domcontentloaded' })
			// await page.waitForSelector('img[alt="Image"][draggable="true"]', { timeout: 10000 })
			// const imageSrc = await page.evaluate(() => {
			// 	const image = document.querySelector('img[alt="Image"][draggable="true"]')
			// 	return image ? image.src : null
			// })

			await page.goto(`https://sotwe.com/${twitterUsername}`, { waitUntil: 'domcontentloaded' }, {timeout: 5000})

			const title = await page.evaluate(() => document.querySelector('title')?.innerText)

			if (title.includes('Twitter Web Viewer & Trend Analyzer & Downloader | Sotwe')) {
				console.log('Account does not exist, skipping')
				return {twitterUsername: twitterUsername, imageSrc: getPokemonImageUrl(), bannerSrc: null, weight: weight, id: id}
			}

			await page.waitForSelector(`img[alt="${twitterUsername}'s profile image"]`, { timeout: 10000 })
			const imageSrc = await page.evaluate((twitterUsername) => {
				const image = document.querySelector(`img[alt="${twitterUsername}'s profile image"]`)
				return image ? image.src : null
			}, twitterUsername)

			if (imageSrc && imageSrc.startsWith('data:image')) {
				throw new Error(`Image source for ${twitterUsername} is a data URL, not a link.`)
			}
			console.log(`${twitterUsername}: ${imageSrc}`)
			let bannerSrc = 'already_exists'
			if (id.includes('notfound')) {
				await page.waitForSelector(`img[alt="${twitterUsername}'s profile banner image"]`, { timeout: 10000 })
				    bannerSrc = await page.evaluate((twitterUsername) => {
					const image = document.querySelector(`img[alt="${twitterUsername}'s profile banner image"]`)
					return image ? image.src : null
				}, twitterUsername)
				console.log(`${twitterUsername}: ${bannerSrc}`)
				
			}
			return {twitterUsername: twitterUsername, imageSrc, bannerSrc, weight, id}
		} catch (error) {
			console.error(`Attempt ${i + 1} failed for ${twitterUsername}: ${error.message}`)
			if (i === attempts - 1) {
				return {twitterUsername: twitterUsername, imageSrc: getPokemonImageUrl(), bannerSrc: null, weight: weight, id: id}
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
	return await Promise.all(chunk.map(([id, { twitterUsername, weight }]) => getAvatar(id, twitterUsername, browser, weight)))
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
			const { twitterUsername, id, imageSrc } = result; // Extract necessary details from each result.
			
			// Update the mapping with a new structure.
			updatedScreenNameToId[twitterUsername] = { id, imageSrc }
			updatedIdToScreenName[id] = { twitterUsername, imageSrc }
		})
		

		remainingEntries.forEach(([id, { twitterUsername, weight }]) => {
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

		

		
		results.forEach((result) => {
			if (result.id.includes('notfound')) {
				const regexPattern = 'profile_banners\\/([^\\/]+)'
				const regex = new RegExp(regexPattern)
				const match = result.bannerSrc ? result.bannerSrc.match(regex) : null

				if (match) {
					result.id = match[1] 

					updatedScreenNameToId[result.twitterUsername] = { id: result.id, imageSrc: result.imageSrc } // Map username to ID
           			updatedIdToScreenName[result.id] = { twitterUsername: result.twitterUsername, imageSrc: result.imageSrc }
					console.log(result.id, result.twitterUsername)

					// since earlier we added only mentionsCountWeighted count for this
					// lookup the new weight and add it to result.weight if the id is found in sortedDmWeightsLookup
					const additionalWeight = sortedDmWeightsLookup[result.id]
					if (additionalWeight) {
						result.weight += additionalWeight
					}
				} else {
					// If not fetching banner, then we don't have their username too

					// console.log(`${result.twitterUsername} No ID found in bannerSrc`)
					// Handle the case where no match is found, if necessary
				}
			}
		})

		fs.writeFileSync('user_mentions_screen_name_mapping.json', JSON.stringify({screenNameToId: updatedScreenNameToId, idToScreenName: updatedIdToScreenName}, null, 2), 'utf8', (err) => {
			if (err) {
			  console.error('An error occurred while writing the JSON to the file:', err)
			} else {
			  console.log('Successfully updated and saved the screen_name to id lookup with new data.')
			}
		  })

		
		results.sort((a, b) => b.weight - a.weight)

		const resultsJson = JSON.stringify(results, null, 2)
		fs.writeFileSync('final_weights_with_pics.json', resultsJson, 'utf8')

		console.log('Successfully saved profile images data to file.')
	} catch (err) {
		console.error('Error:', err)
	}
})()
