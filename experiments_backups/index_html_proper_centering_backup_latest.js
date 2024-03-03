<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Twitter Circle Visualization</title>
<script src="https://d3js.org/d3.v6.min.js"></script>
<style>
  body {
  display: flex;
  flex-direction: column; /* Stack elements vertically */
  align-items: center;
  justify-content: start; /* Align content to the top */
  height: 100vh;
  margin: 0;
  background-color: #f9e4bc; /* Cream background */
}
  
  .node-foreign-object {
  transition: transform 0.2s; /* Smooth transition for any transforms */
  transform-origin: 50% 50%; /* Center the scaling transformation */
  transform-box: fill-box; /* Refer to the object's bounding box for the origin */
  border-radius: 50%; /* Keeps the circular shape */
  overflow: hidden; /* Ensures the content does not spill out on scale */
}

.node-foreign-object:hover {
  transform: scale(1.4); /* Enlarges the foreignObject on hover */
  cursor: pointer;
}

.node-img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Cover the area without stretching */
  border-radius: 50%; /* Ensures the image is circular */
}

label {
    display: block; /* Ensure the label is on its own line */
    margin-bottom: 10px; /* Space between the label and the slider */
    font-size: 30px; /* Larger font size for readability */
}

#slider-container {
  margin-top: 20px;
  text-align: center; /* Center-align the slider text and slider */
  padding: 10px;
  border-radius: 8px; /* Rounded corners for the container */
}

svg#network {
  max-width: 95%; /* Limit SVG size for very large screens */
  height: 95%; /* Adjust height automatically */
  margin-top: 20px; /* Add space between the slider and the SVG */
}



#pfpCountSlider {
    width: 250px; /* Larger width for the slider */
    -webkit-appearance: none; /* Override default appearance for WebKit browsers */
    appearance: none;
    height: 20px; /* Increase the height for a bigger touch area */
    background: #ffc0cb; /* Background color of the slider */
    outline: none; /* Remove the outline to avoid a boxy look when selected */
    opacity: 0.7; /* Slightly transparent */
    transition: opacity 0.2s; /* Smooth transition for hover effect */
}
#pfpCountSlider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 25px; /* Wider thumb for easier grabbing */
    height: 25px; /* Taller thumb for easier grabbing */
    background: hsl(196, 84%, 46%); /* Green color for the thumb */
    cursor: pointer; /* Indicates the thumb is draggable */
    border-radius: 50%; /* Circular thumb */
}

#pfpCountSlider::-moz-range-thumb {
    width: 25px;
    height: 25px;
    background: #4CAF50;
    cursor: pointer;
    border-radius: 50%;
}

@media (max-width: 768px) { /* Adjustments for tablets and mobile phones */
  #slider-container {
    width: 90%; /* Make the slider container take more space */
  }

  #pfpCountSlider {
    width: 100%; /* Make the slider adapt to the container width */
  }

  svg#network {
    max-width: 100%; /* Allow the SVG to fill the container on smaller screens */
  }
}



</style>
</head>
<body>
    
    <div id="slider-container">
        <label for="pfpCountSlider">Number of Profiles: <span id="pfpCount">100</span></label>
        <input type="range" id="pfpCountSlider" min="1" max="100" value="100" step="1">
    </div>
    
    
<svg id="network" width="2000" height="2000"></svg>
<script>
// Load the data from the JSON file




    let center = { x: 0, y: 0 };

    function updateCenter() {
        const svg = d3.select('#network').node();
        const width = svg.clientWidth || svg.parentNode.clientWidth;
        const height = svg.clientHeight || svg.parentNode.clientHeight;
        center.x = width / 2;
        center.y = height / 2;
    }


    d3.json('pfp_dict.json').then(function(data) {
        updateCenter();
    const maxProfiles = data.length;
    document.getElementById('pfpCountSlider').max = maxProfiles;
    document.getElementById('pfpCountSlider').value = maxProfiles;
    document.getElementById('pfpCount').textContent = 'All'; // Default to all

    const svg = d3.select('#network'),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    nodeRadius = 30, // Radius for the profile images
    spacingBetweenNodes = 2, // Spacing between nodes
    spacingBetweenCircles = 20; // Spacing between concentric circles


    // Function to calculate positions
    function calculatePositions(data, startRadius) {
    let currentRadius = startRadius, // Adjust initial radius to start from outside the center node
        currentAngle = 0,
        positions = [],
        nodesInThisCircle,
        circumference;

    // Place the center node
    if (data.length > 0 && data[0].imageSrc !== null) {
        positions.push({ twitterUsername: data[0].twitterUsername, imageSrc: data[0].imageSrc, x: center.x, y: center.y });
    }

    // Start from the second item if the first one is used for the center node
    data.slice(1).forEach((d, i) => {
        if (d.imageSrc === null) {
            return; // Skip this iteration if imageSrc is null
        }

        circumference = 2 * Math.PI * (currentRadius);
        nodesInThisCircle = Math.floor(circumference / (nodeRadius * 2 + spacingBetweenNodes));

        if (currentAngle >= 2 * Math.PI) {
            currentRadius += (nodeRadius * 2) + spacingBetweenCircles; // Adjust for next circle
            currentAngle = 0; // Reset angle for next circle
        }

        const x = center.x + Math.cos(currentAngle) * currentRadius;
        const y = center.y + Math.sin(currentAngle) * currentRadius;
        positions.push({ twitterUsername: d.twitterUsername, imageSrc: d.imageSrc, x, y });

        // Update for next node
        currentAngle += (2 * Math.PI) / nodesInThisCircle;
    });

    return positions;
}

function drawNodes(filteredData) {
        // Clear existing SVG content
        svg.selectAll("*").remove();

        const nodePositions = calculatePositions(filteredData, nodeRadius * 2 + spacingBetweenCircles);
        const simulation = d3.forceSimulation(nodePositions)
            .force("center", d3.forceCenter(center.x, center.y))
            .force("collide", d3.forceCollide().radius(d => nodeRadius * 1.5).strength(0.7));

        // Run the simulation for a few iterations
        for (let i = 0; i < 10; ++i) simulation.tick();

        // Draw the nodes
        nodePositions.forEach(function(d) {
            const foreignObject = svg.append('foreignObject')
                .attr('class', 'node-foreign-object')
                .attr('x', d.x - nodeRadius)
                .attr('y', d.y - nodeRadius)
                .attr('width', nodeRadius * 2)
                .attr('height', nodeRadius * 2);

            const div = foreignObject.append('xhtml:div')
                .style('width', `${nodeRadius * 2}px`)
                .style('height', `${nodeRadius * 2}px`)
                .style('border-radius', '50%')
                .style('overflow', 'hidden');

            div.append('xhtml:img')
                .attr('class', 'node-img')
                .attr('src', d.imageSrc)
                .style('width', '100%')
                .style('height', '100%')
                .on('click', () => window.open(`https://twitter.com/${d.twitterUsername}`, '_blank'));
        });
    }


    drawNodes(data);

    document.getElementById('pfpCountSlider').addEventListener('input', function() {
        updateCenter();
        const value = this.value;
        const filteredData = data.slice(0, value);
        document.getElementById('pfpCount').textContent = value; // Update the displayed count

        drawNodes(filteredData); // Redraw with the filtered data
    });

    window.addEventListener('resize', function() {
        updateCenter();
        // You may need to call a function to redraw your visualization here
        // For example:
        const value = document.getElementById('pfpCountSlider').value
        const filteredData = data.slice(0, value);
        drawNodes(filteredData); // Assuming 'data' is accessible, or you need to manage its scope
    });
    
});
</script>
</body>
</html>
