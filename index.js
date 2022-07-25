// https://stackoverflow.com/questions/5731193/how-to-format-numbers
const formatNumber = (x = 0) =>
    x.toLocaleString (undefined, { minimumFractionDigits: 0 })

const filterTimeArray = (data, start, end) => {
    const startDate = (new Date (start)).getTime()
    const endDate = (new Date (end)).getTime()

    const result = []
    for (let i = 0; i < data.length; i++) {
        const currTime = (new Date (data[i].date)).getTime()
        if (currTime <= endDate && currTime >= startDate) {
            result.push(data[i])
        } else if (currTime > endDate) {
            break
        }
    }
    return result
}

class State {
    static LEVEL_HIERARCHY = { COUNTRY: 0, STATE: 1, COUNTY: 2 }
    static async load_data_with_dates (url, hierarchy, start, end) {
        const dates = {}
        const data = await d3.csv(url)
        const filteredData = filterTimeArray (data, start, end)
        filteredData.forEach(datum => { dates[datum.date] = {} })
    
        switch (hierarchy) {
            case State.LEVEL_HIERARCHY.COUNTRY:
                filteredData.forEach(({ date, cases, deaths }) => {
                    dates[date] = { 
                        cases: parseInt(cases), 
                        deaths: parseInt(deaths)
                    }
                })
                return dates
            case State.LEVEL_HIERARCHY.STATE:
                filteredData.forEach(({ date, state, cases, deaths }) => {
                    dates[date][state] = { 
                        cases: parseInt(cases), deaths: parseInt(deaths)
                    }
                })
                return dates
            default:
                return dates
        }
    }

    constructor (scene, margin, height, width) {
        this.scene = scene
        this.margin = margin, this.height = height, this.width = width
        this.timeParser = d3.timeParse("%Y-%m-%d")
    }

    async load_data (start, end) {
        const countryData = await State.load_data_with_dates (
            `/data/us.csv`, 
            State.LEVEL_HIERARCHY.COUNTRY,
            start, end
        )
        const stateData = await State.load_data_with_dates (
            `/data/us-states.csv`,
            State.LEVEL_HIERARCHY.STATE,
            start, end
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

        this.inverseLookup = {}
        for (let i = 0; i < this.dates.length; i++) {
            this.inverseLookup[this.dates[i]] = i
        }
    }

    lineChart (canvasSelector, tooltipSelector, renderAnnotation) {
        // solidify `this` context
        const data = this.data
        const inverseLookup = this.inverseLookup

        // Adapted from https://d3-graph-gallery.com/graph/line_basic.html    
        // Define Axis
        const x = d3.scaleTime()
            .domain(d3.extent(this.dates, this.timeParser))
            .range([ 0, this.width ])
    
        const y = d3.scaleLinear()
            .domain([
                d3.min(data[State.LEVEL_HIERARCHY.COUNTRY].objects, d => d.cases - 1),
                d3.max(data[State.LEVEL_HIERARCHY.COUNTRY].objects, d => d.cases + 1)
            ])
            .range([ this.height, 0 ])

        // Create Annotations
        renderAnnotation (x, y)

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
                .y(date => y(data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases))
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
            .attr('cy', date => y(data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases))
            .attr('r', 2)
            .style('stroke', 'black')
            .style('stroke-width', '0.1em')
            .on('mouseover', function (event, date) {
                this.style['stroke-width'] = '0.4em'
                this.style.stroke = 'green'
                setTimeout(() => {
                    tooltip.style('opacity', 1)
                        .style('left', `${event.pageX}px`)
                        .style('top', `${event.pageY}px`)
                        .html(`
                            Cases: ${formatNumber(data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases)}     
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
            .on('click', (e, date) => {
                // https://stackoverflow.com/questions/2490825/how-to-trigger-event-in-javascript
                const datepicker = document.getElementById('datepicker')
                datepicker.setAttribute('value', inverseLookup[date])
                const event = new Event('input', { target: datepicker })
                datepicker.dispatchEvent(event)
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
            .domain([ 0, d3.max(states, state => filteredData[state].cases) + 1 ])
            .range([ 0, this.width ])
    
        const y = d3.scaleLinear()
            .domain([ 0, d3.max(states, state => filteredData[state].deaths) + 1 ])
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
            setTimeout(() => {
                tooltip.style('opacity', 1)
                    .style('left', `${event.pageX}px`)
                    .style('top', `${event.pageY}px`)
                    .html(`
                        <strong>${state}</strong>
                        <hr/>
                        Cases: ${formatNumber(filteredData[state].cases)}
                        <br/>
                        Deaths: ${formatNumber(filteredData[state].deaths)}
                    `)
            }, 100)

        })
        .on('mouseout', function () {
            this.style['stroke-width'] = '0.1em'
            this.style.stroke = 'black'
            setTimeout(() => tooltip.style('opacity', 0), 2000)
        })

        // https://www.geeksforgeeks.org/d3-js-axis-tickvalues-function/
        // https://observablehq.com/@d3/d3-format
        d3.select(canvasSelector)
            .append('g')
        .attr('transform',`translate(${this.margin},${this.margin})`)
        .call (
            d3.axisLeft(y)
        )

        d3.select(canvasSelector)
            .append('g')
        .attr('transform',`translate(${this.margin},${this.height + this.margin})`)
        .call (
            d3.axisBottom(x)
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

async function init (data, scene, { start, end }, selectors, datepickerIds, { margin, height, width }) {
    const RADIUS = 5
    const state = new State (scene, margin, height, width)
    await state.load_data (start, end)
    
    // init line chart
    state.lineChart (selectors[0], selectors[1], (x, y) => {
        State.addFixedAnnotations (
            selectors[0], data.map(datum => State.generateAnnotation ({
                y: y (state.data[State.LEVEL_HIERARCHY.COUNTRY].dates[datum.date].cases),
                x: x (state.timeParser(datum.date)),
                dy: datum.offset.dy, dx: datum.offset.dx,
                radius: RADIUS, margin: state.margin,
                label: datum.label
            }))
        )
    })
    
    // init scatter plot
    state.scatterPlot(state.dates[0], selectors[2], selectors[3])

    // add interactions
    const datePicker = document.getElementById(datepickerIds[0])
    const datePickerText = document.getElementById(datepickerIds[1])

    datePicker.setAttribute('max', state.dates.length - 1)

    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
    datePicker.addEventListener('input', event => {
        const date = state.dates[parseInt(event.target.value)]
        datePickerText.innerHTML = `Currently Selected Date: <strong>${date}</strong>`
        updateScatterPlot (state, date, [selectors[2], selectors[3]])
    })
    datePickerText.innerHTML = `Currently Selected Date: <strong>${state.dates[0]}</strong>`

    return state
}

function updateScatterPlot (state, date, selectors) {
    // https://reactgo.com/d3js-remove-svg/
    d3.select(selectors[0]).selectAll('*').remove()
    d3.select(selectors[1]).selectAll('*').remove()
    state.scatterPlot(date, selectors[0], selectors[1])
}