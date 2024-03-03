const fs = require('fs').promises;
const path = require('path');

const extractTwitterData = (tweet_data) => tweet_data.map(data => {
    // Assuming data.tweet is correct, otherwise, adjust accordingly
    let { tweet } = data;
    const timestamp = tweet.created_at;
    const url_id = tweet.id_str;
  
    let userMentions = [];
    let validUrls = [];
  
    if (tweet.entities?.user_mentions) {
      userMentions = tweet.entities.user_mentions.map(mention => ({
        name: mention.name,
        screen_name: mention.screen_name,
        id: mention.id,
        id_str: mention.id_str
      }));
    }
  
    if (tweet.entities?.urls) {
      validUrls = tweet.entities.urls.filter(url => 
        url.expanded_url.match(/^https:\/\/twitter\.com\/\w+\/status\/\d+/)
      ).map(url => ({
        expanded_url: url.expanded_url,
        screen_name: url.expanded_url.split('/')[3]
      }));
    }
    console.log(validUrls)
  
    return { timestamp, url_id, userMentions, validUrls };
  });
  
  const aggregateMentionsWeighted = (data) => {
    const mentionsCount = {};
    const currentTime = new Date(); // Get the current time
    const decayExponent = 0.5; // Adjust based on how quickly you want older mentions to decay
    const decayConstant = 1; // To avoid division by zero in the decay formula
    const linearCoefficient = 0.05

    data.forEach(tweet => {
        // Parse the timestamp from the tweet
        const tweetDate = new Date(tweet.timestamp);

        console.log(tweetDate)

        const timeDiff = Math.max((currentTime - tweetDate) / (1000 * 60 * 60 * 24), 0); // Calculate the time difference in days
        console.log("timeDiff", timeDiff)

        const timeWeight = 1 / (Math.pow(timeDiff + decayConstant, decayExponent) + linearCoefficient * timeDiff);

        tweet.userMentions.forEach(mention => {
        const { screen_name } = mention;
        // Add the mention with the decay factor applied
        mentionsCount[screen_name] = (mentionsCount[screen_name] || 0) + timeWeight;
        });

        tweet.validUrls.forEach(mention => {
        // Assuming validUrls also contains screen_name like userMentions
        const { screen_name } = mention;
        if (screen_name) { // Make sure screen_name is present
            mentionsCount[screen_name] = (mentionsCount[screen_name] || 0) + timeWeight;
        }
        });
    });

    return mentionsCount
  };


  const aggregateMentions = (data) => {
    const mentionsCount = {};

    data.forEach(tweet => {
        // For each user mention in the tweet, increase the count by 1
        tweet.userMentions.forEach(mention => {
            const { screen_name } = mention;
            mentionsCount[screen_name] = (mentionsCount[screen_name] || 0) + 1;
        });

        // (counting quote tweets to other users) assuming validUrls also contains screen_name like userMentions
        tweet.validUrls.forEach(mention => {
            const { screen_name } = mention;
            if (screen_name) { // check undefined
                mentionsCount[screen_name] = (mentionsCount[screen_name] || 0) + 1;
            }
        });
    });

    return mentionsCount;
};


  
  const processTweets = async () => {
    try {
      const filePath = path.join(__dirname, 'twitter-archive/data/tweets.js');
      const data = await fs.readFile(filePath, 'utf8');
      const jsonPart = data.substring(data.indexOf('=') + 1).trim();
      const tweets = JSON.parse(jsonPart);
  
      const extractedData = extractTwitterData(tweets);
      const filteredData = extractedData.filter(item => item.userMentions.length > 0 || item.validUrls.length > 0);



      const accountFilePath = path.join(__dirname, 'twitter-archive/data/account.js');
      const accountData = await fs.readFile(accountFilePath, 'utf8');
      // Extract the JSON part from the account.js file
      const accountJsonPart = accountData.substring(accountData.indexOf('['));
      const account = JSON.parse(accountJsonPart);
  
      // Extract the username from the account information
      const user_handle = account[0].account.username;
      console.log('Username:', user_handle);   

      const filteredDataWithoutUser = filteredData.filter(item => {
        const hasUserMention = item.userMentions?.some(mention => mention.screen_name === user_handle);
        const hasValidUrl = item.validUrls?.some(url => url.screen_name === user_handle);
        return !hasUserMention && !hasValidUrl;
      });
      
      const mentionsWeightedCount = aggregateMentionsWeighted(filteredDataWithoutUser);
      const mentionsCountPure = aggregateMentions(filteredDataWithoutUser)

      const sortedWeightedMentionsArray = Object.entries(mentionsWeightedCount).sort((a, b) => b[1] - a[1]);
      const sortedMentionsArray = Object.entries(mentionsCountPure).sort((a, b) => b[1] - a[1]);
      
      // To put the user in the center, put them at 0 index
      sortedWeightedMentionsArray.unshift([user_handle, 1000]);
      sortedMentionsArray.unshift([user_handle, 1000]);

      const sortedWeightedMentionsObject = Object.fromEntries(sortedWeightedMentionsArray);
      const sortedMentionsObject = Object.fromEntries(sortedMentionsArray);

      
      await fs.writeFile('mentionsCountWeighted2.json', JSON.stringify(sortedWeightedMentionsObject, null, 2), 'utf8');
      await fs.writeFile('mentionsCountPure.json', JSON.stringify(sortedMentionsObject, null, 2), 'utf8');
  
      console.log('Data saved successfully.');
    } catch (error) {
      console.error('Error processing file:', error);
    }
  };
  
  processTweets();
  