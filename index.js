const RADIUS = 5

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

    constructor (scene, margin, height, width, selectors, datepickerIds) {
        this.scene = scene
        this.margin = margin, this.height = height, this.width = width
        this.timeParser = d3.timeParse("%Y-%m-%d")
        this.backup = { }
        this.date = ''
        this.selectors = selectors
        this.datepickerIds = datepickerIds
            .map (id => document.getElementById (id))
    }

    async load_data (start, end) {
        const countryData = await State.load_data_with_dates (
            `https://ildarnasirov.github.io/cs416-final-project/data/us.csv`, 
            State.LEVEL_HIERARCHY.COUNTRY,
            start, end
        )
        const stateData = await State.load_data_with_dates (
            `https://ildarnasirov.github.io/cs416-final-project/data/us-states.csv`,
            State.LEVEL_HIERARCHY.STATE,
            start, end
        )
        const countryObjects = Object.values (countryData)
        const stateObjects = Object.values (stateData)

        this.dates = Object.keys (countryData)
        this.date = this.dates[0]

        this.data = {}
        this.data[State.LEVEL_HIERARCHY.STATE] = { 
            objects: stateObjects, dates: stateData
        }
        this.data[State.LEVEL_HIERARCHY.COUNTRY] = { 
            objects: countryObjects, dates: countryData
        }

        // inverse lookup for easy search
        this.inverseLookup = {}
        this.dates.forEach((d, i) => this.inverseLookup[d] = i)

        // add interactions
        this.datepickerIds[0].setAttribute('max', this.dates.length - 1)
        this.datepickerIds[1].innerHTML = `Currently Selected Date: <strong>${this.date}</strong>`
    }

    lineChart (renderAnnotation) {
        // solidify `this` context
        const STATE = this

        // Adapted from https://d3-graph-gallery.com/graph/line_basic.html
        // Define Axis
        const x = d3.scaleTime()
            .domain(d3.extent(STATE.dates, STATE.timeParser))
            .range([ 0, STATE.width ])

        const y = d3.scaleLinear()
            .domain([
                d3.min(STATE.data[State.LEVEL_HIERARCHY.COUNTRY].objects, d => d.cases - 1),
                d3.max(STATE.data[State.LEVEL_HIERARCHY.COUNTRY].objects, d => d.cases + 1)
            ])
            .range([ STATE.height, 0 ])

        // Create Annotations
        renderAnnotation (x, y)

        // Define main canvas - linechart
        d3.select(STATE.selectors[0])
            .attr('width', STATE.width + 2 * STATE.margin)
            .attr('height', STATE.height + 2 * STATE.margin)
            .append('g')
                .attr('transform', `translate(${STATE.margin},${STATE.margin})`)
            .datum(STATE.dates).append('path')
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5)
            .attr('d', d3.line()
                .x(date => x(STATE.timeParser(date)))
                .y(date => y(STATE.data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases))
            )

        const tooltip = d3.select(STATE.selectors[1])

        // define main canvas - points and tooltip
        d3.select(STATE.selectors[0])
            .attr('width', STATE.width + 2 * STATE.margin)
            .attr('height', STATE.height + 2 * STATE.margin)
            .append('g')
                .attr('transform', `translate(${STATE.margin},${STATE.margin})`)
            .selectAll().data(STATE.dates).enter().append('circle')
            .attr('cx', date => x(STATE.timeParser(date)))
            .attr('cy', date => y(STATE.data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases))
            .attr('r', date => date === STATE.date ? 5 : 2)
            .style('stroke', date => date === STATE.date ? 'blue' : 'black')
            .style('stroke-width', '0.1em')
            .on('mouseover', function (event, date) {
                this.style['stroke-width'] = '0.4em'
                this.style.stroke = 'green'
                setTimeout(() => {
                    tooltip.style('opacity', 1)
                        .style('left', `${event.pageX}px`)
                        .style('top', `${event.pageY}px`)
                        .html(`
                            Cases: ${formatNumber(STATE.data[State.LEVEL_HIERARCHY.COUNTRY].dates[date].cases)}
                            <br>
                            Date: ${date}
                        `)
                }, 100)
            })
            .on('mouseout', function (e, date) {
                this.style['stroke-width'] = '0.1em'
                this.style.stroke = (date === STATE.date) ? 'blue' : 'black'
                setTimeout(() => tooltip.style('opacity', 0), 2000)
            })
            .on('click', (e, date) => {
                STATE.date = date
                this.render (renderAnnotation)
            })

        // Define Axis
        d3.select(STATE.selectors[0])
            .append('g')
        .attr('transform', `translate(${STATE.margin},${STATE.margin})`)
        .call(d3.axisLeft(y))
        .append('g')
            .attr('transform', `translate(${-STATE.margin + 10}, ${STATE.height / 2})`)
        .append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .text('Cases')

        // https://stackoverflow.com/questions/15471224/how-to-format-time-on-xaxis-use-d3-js
        d3.select(STATE.selectors[0])
            .append('g')
        .attr('transform', `translate(${STATE.margin},${STATE.margin + STATE.height})`)
        .call(
            d3.axisBottom(x).tickFormat(d3.timeFormat('%m-%d'))
        )
        .append('text')
        .attr('fill', 'black')//set the fill here
        .attr('transform', `translate(${(STATE.width + STATE.margin) / 2}, 50)`)
        .text('Date')

        // return axis for data transformation
        return { x, y }
    }

    scatterPlot () {
        const STATE = this
        const filteredData = STATE.data[State.LEVEL_HIERARCHY.STATE].dates[STATE.date]
        const states = Object.keys (filteredData)

        // Define Axis
        const x = d3.scaleLinear()
            .domain([ 0, d3.max(states, state => filteredData[state].cases) + 1 ])
            .range([ 0, STATE.width ])

        const y = d3.scaleLinear()
            .domain([ 0, d3.max(states, state => filteredData[state].deaths) + 1 ])
            .range([ STATE.height, 0 ])

        const tooltip = d3.select(STATE.selectors[3])

        d3.select(STATE.selectors[2])
            .attr('width', STATE.width + 2 * STATE.margin)
            .attr('height', STATE.height + 2 * STATE.margin)
        .append('g')
            .attr('transform', `translate(${STATE.margin},${STATE.margin})`)
            .text(`Cases vs. Deaths on ${STATE.date}`)
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
        // https://stackoverflow.com/questions/11189284/d3-axis-labeling
        d3.select(STATE.selectors[2])
            .append('g')
        .attr('transform',`translate(${STATE.margin},${STATE.margin})`)
        .call (
            d3.axisLeft(y)
        )
        .append('g')
            .attr('transform', `translate(${-STATE.margin + 25}, ${STATE.height / 2})`)
        .append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .text('Deaths')

        // https://stackoverflow.com/questions/42388002/d3-axis-label-has-to-be-added-separately
        d3.select(STATE.selectors[2])
            .append('g')
        .attr('transform',`translate(${STATE.margin},${STATE.height + STATE.margin})`)
        .call (
            d3.axisBottom(x)
        )
        .append('text')
        .attr('fill', 'black')
        .attr('transform', `translate(${(STATE.width + STATE.margin) / 2}, 50)`)
        .text('Cases')

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

    updateLineChart (renderAnnotation) {
        const STATE = this
        d3.select(STATE.selectors[0]).selectAll('*').remove()
        d3.select(STATE.selectors[1]).selectAll('*').remove()
        STATE.lineChart (renderAnnotation)
    }

    updateScatterPlot () {
        // https://reactgo.com/d3js-remove-svg/
        d3.select(this.selectors[2]).selectAll('*').remove()
        d3.select(this.selectors[3]).selectAll('*').remove()
        this.scatterPlot()
    }

    render (renderAnnotation) {
        this.datepickerIds[0].setAttribute('value', this.inverseLookup[this.date])
        this.datepickerIds[1].innerHTML = `Currently Selected Date: <strong>${this.date}</strong>`
        this.updateScatterPlot ();
        this.updateLineChart (renderAnnotation)
    }
}

async function init (data, scene, { start, end }, selectors, datepickerIds, { margin, height, width }) {
    const state = new State (scene, margin, height, width, selectors, datepickerIds)
    await state.load_data (start, end)

    const renderAnnotation = (x, y) => State.addFixedAnnotations (
        selectors[0], 
        data.map(datum => State.generateAnnotation ({
                y: y (state.data[State.LEVEL_HIERARCHY.COUNTRY].dates[datum.date].cases),
                x: x (state.timeParser(datum.date)),
                dy: datum.offset.dy, dx: datum.offset.dx,
                radius: RADIUS, margin: state.margin,
                label: datum.label
            })
        )
    )

    state.render (renderAnnotation)

    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
    state.datepickerIds[0].addEventListener('input', function (event) {
        state.date = state.dates[event.target.value]
        state.render (renderAnnotation)
    })
    return state
}