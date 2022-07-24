const LEVEL_HIERARCHY = { COUNTRY: 0, STATE: 1, COUNTY: 2 }

// https://stackoverflow.com/questions/5731193/how-to-format-numbers
const formatNumber = (x = 0) =>
    x.toLocaleString(undefined, { minimumFractionDigits: 0 });

const addFixedAnnotations = (x, y, margin, timeParser, data) => {
    const annotations = [{
        note: {
            label: 'The White House Coronavirus Task Force is established with U.S. Health and Human Services Secretary, Alex Azar, as the head of the Task Force.'
        },
        x: margin + x(timeParser('2020-01-29')),
        y: margin + y(data['2020-01-29'].cases),
        dy: -50,
        dx: 50,
        type: d3.annotationCalloutCircle,
        subject: {
            radius: 5
        },
    },{
        note: {
            label: 'The World Health Organization declares COVID-19 a pandemic.'
        },
        x: margin + x(timeParser('2020-03-11')),
        y: margin + y(data['2020-03-11'].cases),
        dy: -20,
        dx: -100,
        type: d3.annotationCalloutCircle,
        subject: { radius: 5 }
    },{
        note: {
            label: 'President Donald J. Trump declares a nationwide emergency.'
        },
        x: margin + x(timeParser('2020-03-13')),
        y: margin + y(data['2020-03-13'].cases),
        dy: -30,
        dx: -100,
        type: d3.annotationCalloutCircle,
        subject: { radius: 5 }
    }]
    
    return d3.annotation()
        .annotations(annotations);
}

const load_data_with_dates = async (url, hierarchy) => {
    const dates = {}
    const data = await d3.csv(url)
    data.forEach(datum => { dates[datum.date] = {} })

    switch (hierarchy) {
        case LEVEL_HIERARCHY.COUNTRY:
            data.forEach(({ date, cases, deaths }) => {
                dates[date] = { 
                    cases: parseInt(cases), deaths: parseInt(deaths)
                }
            })
            return dates
        case LEVEL_HIERARCHY.STATE:
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

const lineChart = async (data_dir, scene, canvasSelector, tooltipSelector) => {
    const url = `${data_dir}/us-${scene}.csv`
    const data = await load_data_with_dates(url, LEVEL_HIERARCHY.COUNTRY)
    // Adapted from https://d3-graph-gallery.com/graph/line_basic.html
    const dates = Object.keys(data)
    const objects = Object.values(data)
    const margin = 50, height = 300, width = 500
    const timeParser = d3.timeParse("%Y-%m-%d")

    // Define Axis
    const x = d3.scaleTime()
        .domain(d3.extent(dates, timeParser))
        .range([ 0, width ])

    const y = d3.scaleLinear()
        .domain([0, d3.max(objects, d => d.cases)])
        .range([ height, 0 ])

    // Define main canvas - linechart
    d3.select(canvasSelector)
        .attr('width', width + 2 * margin)
        .attr('height', height + 2 * margin)
        .append('g')
            .attr('transform', `translate(${margin},${margin})`)
        .datum(dates).append('path')
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5)
            .attr('d', d3.line()
                .x(date => x(timeParser(date)))
                .y(date => y(data[date].cases))
            )

    const tooltip = d3.select(tooltipSelector)
    
    // define main canvas - scatter
    d3.select(canvasSelector)
        .attr('width', width + 2 * margin)
        .attr('height', height + 2 * margin)
        .append('g')
            .attr('transform', `translate(${margin},${margin})`)
        .selectAll().data(dates).enter().append('circle')
            .attr('cx', date => x(timeParser(date)))
            .attr('cy', date => y(data[date].cases))
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
                            Cases: ${formatNumber(data[date].cases)}
                            <br>
                            Date: ${date}
                        `)
                }, 100)
            })
            .on('mouseout', function (_, _) {
                this.style['stroke-width'] = '0.1em'
                this.style.stroke = 'black'
                setTimeout(() => tooltip.style('opacity', 0), 5000)
            })
    
    // Define Axis
    d3.select(canvasSelector)
        .append('g')
    .attr('transform', `translate(${margin},${margin})`)
    .call(d3.axisLeft(y))

    // https://stackoverflow.com/questions/15471224/how-to-format-time-on-xaxis-use-d3-js
    d3.select(canvasSelector)
        .append('g')
    .attr('transform', `translate(${margin},${margin + height})`)
    .call(
        d3.axisBottom(x).tickFormat(d3.timeFormat('%m-%d'))
    )

    // add annotations
    d3.select(canvasSelector)
        .append('g')
    .attr('class', 'annotation-group')
    .call(addFixedAnnotations(x, y, margin, timeParser, data))
}
