// https://stackoverflow.com/questions/5731193/how-to-format-numbers
const formatNumber = (x = 0) =>
    x.toLocaleString (undefined, { minimumFractionDigits: 0 })

class State {
    static LEVEL_HIERARCHY = { COUNTRY: 0, STATE: 1, COUNTY: 2 }
    static async load_data_with_dates (url, hierarchy) {
        const dates = {}
        const data = await d3.csv(url)
        data.forEach(datum => { dates[datum.date] = {} })
    
        switch (hierarchy) {
            case State.LEVEL_HIERARCHY.COUNTRY:
                data.forEach(({ date, cases, deaths }) => {
                    dates[date] = { 
                        cases: parseInt(cases), deaths: parseInt(deaths)
                    }
                })
                return dates
            case State.LEVEL_HIERARCHY.STATE:
                data.forEach(({ date, state, cases, deaths }) => {
                    dates[date][state] = { 
                        cases: parseInt(cases), deaths: parseInt(deaths)
                    }
                })
                return dates
            default:
                return dates
        }
    }

    constructor (scene) {
        this.scene = scene
        this.margin = 50, this.height = 300, this.width = 500
        this.timeParser = d3.timeParse("%Y-%m-%d")
    }

    async load_data () {
        const countryData = await State.load_data_with_dates (
            `/data/us-${this.scene}.csv`, 
            State.LEVEL_HIERARCHY.COUNTRY
        )
        const stateData = await State.load_data_with_dates (
            `/data/us-states-${this.scene}.csv`, 
            State.LEVEL_HIERARCHY.STATE
        )
        const countryObjects = Object.values (countryData)
        const stateObjects = Object.values (stateData)

        this.dates = Object.keys (countryData)
        this.data = {}
        this.data[State.LEVEL_HIERARCHY.STATE] = { 
            objects: stateObjects, 
            dates: stateData
        }
        this.data[State.LEVEL_HIERARCHY.COUNTRY] = { 
            objects: countryObjects,
            dates: countryData
        }
    }

    lineChart (canvasSelector, tooltipSelector) {
        // Adapted from https://d3-graph-gallery.com/graph/line_basic.html    
        // Define Axis
        const x = d3.scaleTime()
            .domain(d3.extent(this.dates, this.timeParser))
            .range([ 0, this.width ])
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(this.data[State.LEVEL_HIERARCHY.COUNTRY].objects, d => d.cases)])
            .range([ this.height, 0 ])

        console.log(this.data)
        console.log(this)
    
        // Define main canvas - linechart
        d3.select(canvasSelector)
            .attr('width', this.width + 2 * this.margin)
            .attr('height', this.height + 2 * this.margin)
            .append('g')
                .attr('transform', `translate(${this.margin},${this.margin})`)
            .datum(this.dates).append('path')
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5)
            .attr('d', d3.line()
                .x(date => x(this.timeParser(date)))
                .y(date => y(this.data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases))
            )
    
        const tooltip = d3.select(tooltipSelector)
        
        // define main canvas - points and tooltip
        d3.select(canvasSelector)
            .attr('width', this.width + 2 * this.margin)
            .attr('height', this.height + 2 * this.margin)
            .append('g')
                .attr('transform', `translate(${this.margin},${this.margin})`)
            .selectAll().data(this.dates).enter().append('circle')
            .attr('cx', date => x(this.timeParser(date)))
            .attr('cy', date => y(this.data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases))
            .attr('r', 2)
            .style('stroke', 'black')
            .style('stroke-width', '0.1em')
            .on('mouseover', function (event, date) {
                this.style['stroke-width'] = '0.25em'
                this.style.stroke = 'darkblue'
                setTimeout(() => {
                    tooltip.style('opacity', 1)
                        .style('left', `${event.pageX}px`)
                        .style('top', `${event.pageY}px`)
                        .html(`
                            Cases: ${formatNumber(this.data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases)}
                            <br>
                            Date: ${date}
                        `)
                }, 100)
            })
            .on('mouseout', function () {
                this.style['stroke-width'] = '0.1em'
                this.style.stroke = 'black'
                setTimeout(() => tooltip.style('opacity', 0), 5000)
            })
        
        // Define Axis
        d3.select(canvasSelector)
            .append('g')
        .attr('transform', `translate(${this.margin},${this.margin})`)
        .call(d3.axisLeft(y))
    
        // https://stackoverflow.com/questions/15471224/how-to-format-time-on-xaxis-use-d3-js
        d3.select(canvasSelector)
            .append('g')
        .attr('transform', `translate(${this.margin},${this.margin + this.height})`)
        .call(
            d3.axisBottom(x).tickFormat(d3.timeFormat('%m-%d'))
        )

        // return axis for data transformation
        return { x, y }
    }

    scatterPlot (date, canvasSelector, tooltipSelector) {
        const filteredData = this.data[State.LEVEL_HIERARCHY.STATE].dates[date]
        const states = Object.keys (filteredData)

        // Define Axis
        const x = d3.scaleLinear()
            .domain([ 1, d3.max(states, state => filteredData[state].cases) + 1 ])
            .range([ 0, this.width ])
    
        const y = d3.scaleLinear()
            .domain([ 1, d3.max(states, state => filteredData[state].deaths) + 1 ])
            .range([ this.height, 0 ])
        const tooltip = d3.select(tooltipSelector)

        d3.select(canvasSelector)
            .attr('width', this.width + 2 * this.margin)
            .attr('height', this.height + 2 * this.margin)
        .append('g')
            .attr('transform', `translate(${this.margin},${this.margin})`)
            .text(`Cases vs. Deaths on ${date}`)
        .selectAll()
            .data(states).enter()
        .append('circle')
            .attr('cx', state => x(filteredData[state].cases))
            .attr('cy', state => y(filteredData[state].deaths))
            .attr('r', 4)
                // Source https://stackoverflow.com/questions/13563471/random-colors-for-circles-in-d3-js-graph
            .style('fill', () => `hsl(${Math.random() * 360}, 100%, 50%)`)
            .style('stroke', 'black')
            .style('stroke-width', '0.1em')
        .on('mouseover', function (event, state) {
            this.style['stroke-width'] = '0.25em'
            this.style.stroke = 'darkblue'
            console.log(state)
            setTimeout(() => {
                tooltip.style('opacity', 1)
                    .style('left', `${event.pageX}px`)
                    .style('top', `${event.pageY}px`)
                    .html(`
                        <strong>${state}</strong>
                        <hr/>
                        Cases: ${filteredData[state].cases}
                        <br/>
                        Deaths: ${filteredData[state].deaths}
                    `)
            }, 100)

        })
        .on('mouseout', function () {
            this.style['stroke-width'] = '0.1em'
            this.style.stroke = 'black'
            setTimeout(() => tooltip.style('opacity', 0), 5000)
        })

        // https://www.geeksforgeeks.org/d3-js-axis-tickvalues-function/
        // https://observablehq.com/@d3/d3-format
        d3.select(canvasSelector)
            .append('g')
        .attr('transform',`translate(${this.margin},${this.margin})`)
        .call (
            d3.axisLeft(y).tickFormat(d3.format(".0s"))
        )

        d3.select(canvasSelector)
            .append('g')
        .attr('transform',`translate(${this.margin},${this.height + this.margin})`)
        .call (
            d3.axisBottom(x).tickFormat(d3.format(".0s"))
        )

        return { x, y }
    }

    static addFixedAnnotations (canvasSelector, annotations) {
        d3.select(canvasSelector)
            .append('g')
        .attr('class', 'annotation-group')
        .call(d3.annotation().annotations(annotations))
    }

    static generateAnnotation ({ x, y, dy, dx, label, margin, radius }) {
        return {
            note: { label }, dy, dx,
            x: margin + x, y: margin + y,
            type: d3.annotationCalloutCircle,
            subject: { radius }
        }
    }
}

async function main (data, scene, selectors) {
    const RADIUS = 5
    const state = new State (scene); await state.load_data ()
    const { x: lineChartX, y: lineChartY } = state.lineChart (
        selectors[0], selectors[1]
    )
    const annotations = data.map(datum => State.generateAnnotation ({
        x: lineChartX (state.timeParser(datum.date)),
        y: lineChartY (state.data[State.LEVEL_HIERARCHY.COUNTRY].dates[datum.date].cases),
        dy: datum.offset.dy, dx: datum.offset.dx,
        radius: RADIUS, margin: state.margin,
        label: datum.label
    }))
    State.addFixedAnnotations (selectors[0], annotations)

    state.scatterPlot(data[0].date, selectors[2], selectors[3])
}