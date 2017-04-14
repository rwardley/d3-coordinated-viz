/* JS for D-3 Coordinated-Viz by Rosemary P. Wardley, 2017 */

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["2010", "2011", "2012", "2013", "2014"]; //list of attributes
    
var expressed = attrArray[0]; //initial attribute
    //console.log(expressed);

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 460,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 1,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";


//create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
    .range([chartHeight, 0])
    //.range([25, chartHeight])
    .domain([25, 55000]);
    //.nice()
    
//example 1.3
//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
    //example 2.1
    //map frame dimensions
    var width = window.innerWidth * 0.50,
        height = 460;
    
    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);
    
    //create global projection
    var projection = d3.geoFahey()
        .scale(120)
        .translate([width / 2, height / 2]);
    //example 2.2
     var path = d3.geoPath()
        .projection(projection);
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "./data/OIV.csv") //load attributes from csv
        .defer(d3.json, "./data/world_110m.topojson") //load choropleth spatial data
        .await(callback);
    
    //example 1.5
    function callback(error, csvData, world){
        
        //place graticule on the map
        setGraticule(map, path);
        
        //translate TopoJSON
        var countries = topojson.feature(world, world.objects.world_110m).features;
        
        //should this be var world??
        // Add world geojson to map
        var world = map.append("path")
            .datum(countries)
            .attr("class", "world")
            .attr("d", path);
        
        //join csv data to GeoJSON enumeration units
        countries = joinData(countries, csvData);
        
        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(countries, map, path, colorScale);
        
        //add coordinated visualization to the map
        setChart(csvData, colorScale);
        
        //added this to finally get the dropdown to show up!
        //need to figure out how to get the attributes in it
        createDropdown(csvData); //create the dropdown menu
        
        //examine the results
        //console.log(countries);
        //console.log(csvData);
        //console.log(colorScale);
        };
}; //end of setMap()

function setGraticule(map, path){
    //example 2.5
    //create graticule generator
    var graticule = d3.geoGraticule()
        .step([15, 15]); //place graticule lines every 15 degrees of longitude and latitude

    //example 2.8 create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //example 2.6 line 5...create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(countries, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i < csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.iso_a3; //the CSV primary key
            
            //console.log(csvRegion);
            //console.log(csvKey);

            //loop through geojson regions to find correct region
            for (var a=0; a<countries.length; a++){

                var geojsonProps = countries[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.iso_a3; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                    //console.log(geojsonProps);
                };
            }; 
        };
    return countries;
};
    
function setEnumerationUnits(countries, map, path, colorScale){
    //add World regions to map
    var world = map.selectAll(".world")
        .data(countries)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "world " + d.properties.iso_a3;
            //return "world " + d.properties.Country;
            //return "world " + d.iso_a3;
        })
        .attr("d", path)
        .style("fill", function(d){
            //SOMEHOW BOTH OF THESE SEEM TO WORK??
         //return colorScale(d.properties[expressed]);
         return choropleth(d.properties, colorScale);
        })
       // need to pass the anonymous function to access only the d properties; otherwise, we'd be getting all the data
        .on("mouseover", function(d) {
            highlight(d.properties);
        })
        .on("mouseout", function(d) {
            dehighlight(d.properties);           
        })
        .on("mousemove", moveLabel);
    
    var desc = world.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    //console.log(world);
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        //"#f2d0e0",
        "#feebe2",
        "#fbb4b9",
        //"#e373a8",
        "#DD1C77",
        "#980043",
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //console.log(clusters);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d) {
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};
    
//function to test for data value and return color
function choropleth (props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign it a color, otherwise grey
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale (val);
    } else {
        return "#ffffff";
    };
};
    
//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
    
    //NEW axis create a rectangle for chart background fill
    //why is this background smaller than the map??
    var chartBackground = d3.select("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bars for each country    THIS IS ALSO IN CHANGE ATTRIBUTE DO WE NEED BOTH??
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            //a-b -> b-a reverses bar order
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.iso_a3; //or iso_a3?
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        //WHEN DO WE ADD THESE?
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);
    
     // Add style descriptor to each rectangle
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
    //example 2.10...create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 50)
        .attr("y", 40)
        .attr("class", "chartTitle")
        //.text("Number of Variable " + expressed[3] + " in each region");
    
    //NEW example 2.12 create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        //this determines the frame ratio
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
}; //end of setChart()
    
//function to create a dropdown menu for attribute selection
function createDropdown(csvData) {
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Year of Production");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d) { return d; })
        .text(function(d){ return d; });
    //console.log(attrOptions);
};

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;
    
    //recreate the color scale
    var ColorScale = makeColorScale(csvData);

    //recolor enumeration units
    var world = d3.selectAll(".world")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, ColorScale)
        });
    
    /*/re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition()
        .delay(function(d, i) {
            return i * 20;
        })
        .duration(500);*/
    
    // changing axis based on the max value for the selected attribute
    var max = d3.max(csvData,function(d){
        return + parseFloat(d[expressed]);
        });
    
    //reset yScale to new range of data selected by user
    //var yScale = d3.scaleLinear()
      //  .range([0, chartHeight])
        //.range([463, 0])
        //.domain([0, 50005]);
        //.domain([0, max]);
    
    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition()
        .delay(function(d, i) {
            return i * 20;
        })
        .duration(500);
       
    updateChart(bars, csvData.length, ColorScale);
}; //end of changeAttribute()

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){ 
    //position bars
    bars.attr("x", function(d, i){
            //return i * (chartInnerWidth / n) + leftPadding;
            return i * (chartWidth / n)+ leftPadding;s
        })
        //size/resize bars 
        .attr("height", function(d, i){
            //return 463 - yScale(parseFloat(d[expressed]));
            //return 0 - yScale(parseFloat(d[expressed]));
            return 5000 - yScale(parseFloat(d[expressed])) + topBottomPadding;
            //return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
            //return chartHeight - yScale(parseFloat(d[expressed]));
            //return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        })
        //recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
    var chartTitle = d3.select(".chartTitle")
        .text("Millions of Litres of Wine Produced in " + expressed +"");

    // Bob Cowlings' fix to adjust the yAxis
    var yAxis = d3.axisLeft()
        .scale(yScale)
        //Format the charts axis labels
        .tickFormat(function (d) {
            if ((d / 1000) >= 1) {
                d = d / 1000 + "K";
            }
            return d;
            //console.log(d);
        }); 

    //update the charts axis    
    var update_yAxis = d3.selectAll("g.axis")
    .call(yAxis);
};
    
 //function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.iso_a3) //or iso_a3?
        .style("stroke", "blue")
        .style("stroke-width", "2");
    //console.log("hello", "." + props.iso_a3);
    // add dynamic label on mouseover
        setLabel(props);  
};
    
//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.iso_a3)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
     d3.select(".infolabel")
        .remove();
};
    
//function to create dynamic label
function setLabel(props){
    //label content
    //var labelAttribute = "<h1>" + props[2] +
      //  "</h1><b>" + expressed + "</b>";
    console.log(props);
/*
    props.2013
    props["2013"]
    props["Country"]
    props.Country*/
    
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + props["Country"] + ", </b>" + "</h1><i>" + expressed + "</i>";

//    <div id="USA_Country" class="infolabel">labelatribete</div>
    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.iso_a3 + "_Country")
        //.attr("id", props.country + "Country")
        .html(labelAttribute);
    
    //var labelAttributeD3 = infolabel.append("h1")
      //  .attr("class", "volume")
        //.html(props[expressed]);
    
    //var labelAttributeYear = infolabel.append("h1")
      //  .attr("class", "year")
        //.html(expressed);

    //this is doing the same thing as the string above. prob better this way
    //var countryName = infolabel.append("div")
      //  .attr("class", "countryName")
        //.html(props.Country);
    //console.log(infolabel);
};
    
//function to move info label with mouse
function moveLabel(){
    //use coordinates of mousemove event to set label coordinates
    //var x = d3.event.clientX + 10,
      //  y = d3.event.clientY - 75;
     //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;
    
    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;
    
    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};   
})(); //last line of main.js