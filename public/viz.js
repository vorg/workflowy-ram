var E = React.createElement;

function handleClientLoad() {
    console.log('GAPI Loaded');
    gapi.client.setApiKey(Config.apiKey);
    gapi.auth.authorize({client_id: Config.clientId, scope: Config.scopes, immediate: true}, handleAuthResult)
}

function handleAuthResult(authResult) {
  console.log('handleAuthResult', authResult);
  if (authResult && !authResult.error) {
    loadCalendars();
  }
  else {
    //immediate = false -> go to auth page
    gapi.auth.authorize({client_id: Config.clientId, scope: Config.scopes, immediate: false}, handleAuthResult)
  }
}

function loadCalendars() {
    console.log('loadCalendars');
	gapi.client.load('calendar', 'v3', function() {
      var request = gapi.client.calendar.calendarList.list();
      var calendarList = [];
      request.execute(function(response) {
        response.items.forEach(function(calendar) {
          calendarList.push({
            id: calendar.id,
            name: calendar.summary
          });
        });
        console.log('UserActions.updateCalendarList', calendarList);
        calendarList.forEach(function(calendar) {
            if (calendar.name == Config.calendarName) {
                loadCalendarItems(calendar);
            }
        });
      });
    });
}

var State = {
    app: null
}

/**
 * Get the ISO week date week number
 */
Date.prototype.getWeek = function () {
	// Create a copy of this date object
	var target  = new Date(this.valueOf());

	// ISO week date weeks start on monday
	// so correct the day number
	var dayNr   = (this.getDay() + 6) % 7;

	// ISO 8601 states that week 1 is the week
	// with the first thursday of that year.
	// Set the target date to the thursday in the target week
	target.setDate(target.getDate() - dayNr + 3);

	// Store the millisecond value of the target date
	var firstThursday = target.valueOf();

	// Set the target to the first thursday of the year
	// First set the target to january first
	target.setMonth(0, 1);
	// Not a thursday? Correct the date to the next thursday
	if (target.getDay() != 4) {
		target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
	}

	// The weeknumber is the number of weeks between the
	// first thursday of the year and the thursday in the target week
	return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
}

function loadCalendarItems(calendar) {
  console.log('loadCalendarItems', calendar.name);
  var start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  var end = new Date();
  var request = gapi.client.calendar.events.list({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    calendarId: calendar.id
  })

  var thisWeek = end.getWeek();

  request.execute(function(response) {
    console.log(response);
    var items = response.items;
    var currentWeek = (new Date()).getWeek();
    items.forEach(function(item) {
        item.startDate = new Date(item.start.dateTime);
        item.startTime = item.startDate.getTime();
        item.startWeek = item.startDate.getWeek();
        item.endDate = new Date(item.end.dateTime);
        item.endTime = item.endDate.getTime();
    })
    items.sort(function(a, b) {
        return a.startTime - b.startTime;
    });
    items = items.filter(function(item) {
        return item.startWeek == currentWeek || item.startWeek == currentWeek - 1;
    })

    var prevWeek = { 'Var Total (d)' : 0, 'Vorg Total (d)' : 0 };
    var thisWeek = { 'Var Total (d)' : 0, 'Vorg Total (d)' : 0 };
    var weeks = [prevWeek, thisWeek];
    items.forEach(function(item) {
        var tokens = item.summary.trim().split(' ');
        var valid = ["Sleep", "Var", "Vorg"].indexOf(tokens[0]) != -1;
        if (!valid) return;
        var projectName = tokens[0] + (tokens[1] ? ' ' + tokens[1] : '');
        var weekIndex = (item.startWeek == currentWeek) ? 1 : 0;
        var duration = (item.endTime - item.startTime) / (1000 * 60 * 60);
        weeks[weekIndex][projectName] = (weeks[weekIndex][projectName] || 0) + duration;
        if (tokens[0] == 'Var') {
            weeks[weekIndex]['Var Total (d)'] = Math.floor(((weeks[weekIndex]['Var Total (d)'] || 0) + duration/8)*10)/10;
        }
        if (tokens[0] == 'Vorg') {
            weeks[weekIndex]['Vorg Total (d)'] = Math.floor(((weeks[weekIndex]['Vorg Total (d)'] || 0) + duration/8)*10)/10;
        }
        if (tokens[0] == "Sleep") {
            if (!weeks[weekIndex]["Sleep/d"]) {
              weeks[weekIndex]["Sleep/d"] = {}
            }
            var date = moment(item.startTime).format('YYYY-MM-DD')
            weeks[weekIndex]["Sleep/d"][date] = true
        }
    })

    weeks[0]["Sleep/d"] = weeks[0]["Sleep"] / Object.keys(weeks[0]["Sleep/d"]).length
    weeks[1]["Sleep/d"] = Math.floor(weeks[1]["Sleep"] / Object.keys(weeks[1]["Sleep/d"]).length * 10) / 10
    delete weeks[0]["Sleep"];
    delete weeks[1]["Sleep"];

    weeks = weeks.map(function(week) {
        return Object.keys(week).map(function(projectName) {
            return { name: projectName, duration: week[projectName] }
        }).sort(function(a, b) {
            if (a.name.indexOf('/d') != -1) return 1;
            if (b.name.indexOf('/d') != -1) return -1;
            if (a.name.indexOf('(d)') != -1) return 1;
            if (b.name.indexOf('(d)') != -1) return -1;
            return a.duration - b.duration;
        }).reverse();
    });
    State.app.setState({ weeksItems: weeks });
  });
}

function getText(url, callback) {
    var r = new XMLHttpRequest();
    r.open('GET', url, true);
    r.onreadystatechange = function () {
        if (r.readyState != 4 || r.status != 200) return;
        callback(null, r.responseText);
    };
    r.send('');
}

function getJSON(url, callback) {
    getText(url, function(err, data) {
        if (err) {
            callback(err, data);
        }
        else {
            try {
                callback(null, JSON.parse(data));
            }
            catch(e) {
                callback(e, null);
            }
        }
    })
}

function subitems(item, list) {
    list = list || [];
    if (item.ch) {
        item.ch.map(function(item) {
            list.push(item)
            subitems(item, list)
        })
    }
    return list;
}

function remap(val, oldmin, oldmax, newmin, newmax) {
    return newmin + (val - oldmin)/(oldmax - oldmin)*(newmax - newmin);
}

function min(a, b) {
    return Math.min(a, b)
}

function max(a, b) {
    return Math.max(a, b)
}

function packRectangles(rectangles, rowHeight) {
    var rows = [];

    //find top row y
    var minY = rectangles.reduce(function(minY, rect) {
        return Math.min(minY, rect.y)
    }, Infinity)
    console.log('minY', minY);

    //sort by rectangle start
    rectangles.sort(function(a, b) {
        return a.x - b.x;
    })

    console.log('fitting')
    rectangles.forEach(function(rect) {
        for(var i=0; i<rows.length; i++) {
            var row = rows[i];
            var conflict = false
            for(var j=0; j<row.length; j++) {
                var otherRect = row[j];
                if ((otherRect.x <= rect.x) && (otherRect.x + otherRect.width + rowHeight >= rect.x)) {
                    conflict = true;
                }
            }
            if (!conflict) {
                rect.y = i * rowHeight;
                row.push(rect);
                return;
            }
        }
        var row = [];
        rect.y = rows.length * rowHeight;
        row.push(rect)
        rows.push(row)
    })

    return rows.length * rowHeight
}

var App = React.createClass({
    getInitialState: function() {
        State.app = this;
        console.log('init', this.props.data)
        var root = { ch: this.props.data, nm: 'Workflowy' }

        var current = root;

        if (localStorage.currentId) {
            var id = localStorage.currentId;

            function scanChildren(item) {
                if (item.id == id) {
                    current = item;
                }
                if (item.ch) {
                    item.ch.map(function(child) {
                        child.parent = item;
                        scanChildren(child)
                    })
                }
            }

            scanChildren(root)
        }

        return {
            root: root,
            current: current,
            weeksItems: []
        };
    },
    onItemClick: function(e, child) {
        e.preventDefault();
        e.stopPropagation();
        this.showItem(child);
        return false;
    },
    showItem: function(item) {
        localStorage.currentId = item.id;
        this.setState({ current: item })
    },
    onItemLinkClick: function(e, item) {
        e.preventDefault();
        e.stopPropagation();
        document.location.href = 'https://workflowy.com/#/' + item.id;
        return false;
    },
    render: function() {
        var rem = 16; //16px
        var panelWidth = (18 + 0.5) * rem;
        var current = this.state.current;
        var panels = [];
        var timelineWidth = window.innerWidth - 2 * rem;
        var timelineHeight = 0
        var timelineItems = []
        var self = this;

        function normalizeName(str) {
            str = str.replace(/^[0-9]{6}/,'')
            str = str.replace(/#[^ ]+/g,'')
            str = str.replace(/@[^d][^ ]+/g,'')
            str = str.replace(/-/g, ' ')
            str = str.replace(/<b>/ig,'')
            str = str.replace(/<\/b>/ig,'')

            str = str.split(' ');
            str = str.map(function(s, i) {
                s += ' ';
                if (s[0] == '#' || s[0] == '@') {
                    return E('span', { className: 'tag', key: i }, s);
                }
                return s;
            })

            return str;
        }

        function hasTag(tag) {
            return function(item) {
                return item.nm.indexOf(tag) != -1;
            }
        }

        function extractTimespan(item) {
            var matches = item.nm.match(/@timespan\(([^\)]+)\)/)
            var timespan = matches ? matches[1] : null;
            if (!timespan) {
                console.log('invalid @timespan', item.nm)
                return null;
            }
            var dates = timespan.split('..');
            var start = null;
            if (dates[0].length == 10) {
                start = moment(dates[0], 'YYYY-MM-DD').toDate();
            }
            else if (dates[0].length == 6) {
                start = moment(dates[0], 'YYMMDD').toDate()
            }
            else if (dates[0].length == 7) {
                start = moment(dates[0], 'YYYY-MM').toDate();
            }
            else {
                start = new Date()
            }
            var end = null;
            if (dates.length == 2) {
                if (dates[1].length == 10) {
                    end = moment(dates[1], 'YYYY-MM-DD').toDate();
                }
                else if (dates[1].length == 6) {
                    end = moment(dates[1], 'YYMMDD').toDate()
                }
                else if (dates[1].length == 7) {
                    end = moment(dates[1], 'YYYY-MM').endOf('month').toDate();
                }
                else {
                    //alert(dates[1])
                }
            }
            else {
                //if no end we treet project as one month
                end = moment(start).endOf('month').toDate();
            }
            return [item, start, end];
        }

        function extractMaybe(item) {
            var maybe = item.nm.match(/@maybe\(([^\)]+)\)/)[1];
            if (!maybe || (maybe.indexOf('..') === -1)) {
                console.log('invalid @maybe', item.nm)
                return null;
            }
            var dates = maybe.split('..');
            var start = (dates[0].length == 10) ? moment(dates[0], 'YYYY-MM-DD').toDate() : moment(dates[0], 'YYMMDD').toDate()
            var end = (dates[1].length == 10) ? moment(dates[1], 'YYYY-MM-DD').toDate() : moment(dates[1], 'YYMMDD').toDate()
            return [item, start, end];
        }

        function extractDue(item) {
            var dueStr = (item.nm.match(/@due\(([^\)]+)\)/) || [''])[1];
            var due = null;

            var patterns = ['YYYY-MM-DD', 'YYYY-MM-DD HH:MM', 'YYYYMMDD'];

            for(var i=0; i<patterns.length; i++) {
                if (moment(dueStr, patterns[i]).isValid()) {
                    due = moment(dueStr, patterns[i]).toDate();
                    break;
                }
            }

            if (!due) {
                console.log('invalid @due', item.nm)
                return null;
            }

            //FIXME: boron date hack for 2013
            if (due.getFullYear() == 2013) {
                return null;
            }

            //FIXME: future date over a year
            if (due.getFullYear() == 2017) {
                return null;
            }

            return [item, due];
        }

        function dateToTime(d) {
            return d.getTime()
        }

        function notNull(o) {
            return o;
        }

        if (current.ch) {
            var descendants = subitems(current);
            console.log('descendants', descendants.length)

            var timespans = descendants.filter(hasTag('@timespan')).map(extractTimespan).filter(notNull);
            var maybes = descendants.filter(hasTag('@maybe')).map(extractMaybe).filter(notNull);
            var dueDates = descendants.filter(hasTag('@due')).map(extractDue).filter(notNull);

            console.log('timespans', timespans)

            var datesRange = []
                .concat(timespans.map(R.prop('1')))
                .concat(timespans.map(R.prop('2')))
                .concat(dueDates.map(R.prop('1')))
                .map(dateToTime)
            var startDate = datesRange.reduce(min, Date.now())
            startDate = moment('2016-01-01').toDate(); //FIXME: hardcoded start date
            var endDate = datesRange.reduce(max, Date.now())

            var h = 12;
            var margin = 2

            var rects = [];

            rects = rects.concat(maybes.map(function(maybe, i) {
                var start = maybe[1].getTime()
                var end = maybe[2].getTime()
                var sx = remap(start, startDate, endDate, 0, timelineWidth)
                var ex = remap(end, startDate, endDate, 0, timelineWidth)

                var y = timelineHeight;
                timelineHeight += h + margin;
                return {
                    x: sx,
                    y: y,
                    width: ex - sx,
                    height: h,
                    title: (normalizeName(maybe[0].nm).join(' ') + '').toUpperCase(),
                    color: 'rgba(255, 200, 0, 0.5)'
                }
            }))

            rects = rects.concat(timespans.map(function(timespan, i) {
                var start = timespan[1].getTime()
                var end = timespan[2].getTime()
                var sx = remap(start, startDate, endDate, 0, timelineWidth)
                var ex = remap(end, startDate, endDate, 0, timelineWidth)

                var y = timelineHeight;
                timelineHeight += h + margin
                return {
                    x: sx,
                    y: y,
                    width: ex - sx,
                    height: h,
                    title: (normalizeName(timespan[0].nm).join(' ') + '').toUpperCase(),
                    color: '#f1c40f'
                }
            }))

            var dueDatesHeight = 0;
            rects = rects.concat(dueDates.map(function(dueDate, i) {
                var start = dueDate[1].getTime()
                var sx = remap(start, startDate, endDate, 0, timelineWidth)
                var ex = sx + 10
                var y = dueDatesHeight;
                dueDatesHeight += h + margin
                return {
                    x: sx,
                    y: y,
                    width: ex - sx,
                    height: h,
                    title: (normalizeName(dueDate[0].parent ? dueDate[0].parent.nm : '').join(' ') + '\n' + (dueDate[0].nm)).toUpperCase(),
                    color: 'rgba(255, 50, 0, 1)'
                }
            }))

            timelineHeight = packRectangles(rects, h + margin)

            timelineItems = timelineItems.concat(rects.map(function(rect, i) {
                if (rect.width < 0) {
                    console.log('ERROR: Rect has invalid width', rect)
                    return null;
                }
                return E('g', { key: 'rect-'+i },
                    E('rect', { fill: rect.color, x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        E('title', {}, rect.title)
                    ),
                    E('clipPath', { id: 'clip-path-' + i},
                        E('rect', { fill: rect.color, x: rect.x, y: rect.y, width: rect.width, height: rect.height })
                    ),
                    E('text', { x: Math.max(0, rect.x) + 2, y: rect.y + 10, clipPath: 'url(#clip-path-'+i+')', style: { fontSize: 10, fill: 'black', pointerEvents: 'none' }}, rect.title)
                )
            }))

            var dateTicks = []
            var startWeek = moment(startDate).startOf('isoweek');
            var endWeek = moment(endDate).startOf('isoweek').add(1, 'week');

            var tickPeriod = 'week';
            var tickStep = 1;
            //tickStep = 'month'

            while(startWeek.toDate().getTime() < endWeek.toDate().getTime()) {
                dateTicks.push(startWeek.clone().toDate())
                startWeek = startWeek.add(tickStep, tickPeriod);
            }

            timelineHeight = Math.max(timelineHeight, dueDatesHeight)
            timelineHeight += 50 //bottom padding

            timelineItems = timelineItems.concat(dateTicks.map(function(date, i) {
                var x = remap(date.getTime(), startDate, endDate, 0, timelineWidth)
                if (i == dateTicks.length - 1) {
                    x = timelineWidth - 30;
                }
                var date = moment(date).format('Do')
                return E('text', { x: x, y: timelineHeight - 10, key: 'date-tick-'  + i }, date);
            }));

            var prevMonth = '';
            timelineItems = timelineItems.concat(dateTicks.map(function(date, i) {
                var x = remap(i, 0, dateTicks.length-1, 0, timelineWidth);
                if (i == dateTicks.length - 1) {
                    x = timelineWidth - 30;
                }
                var month = moment(date).format('MMM')
                var label = '';
                if (prevMonth != month) {
                    label = month;
                    prevMonth = month;
                }
                return E('text', { x: x, y: timelineHeight - 30, key: 'month-' + i }, label);
            }));

            var prevYear = '';
            timelineItems = timelineItems.concat(dateTicks.map(function(date, i) {
                var x = remap(i, 0, dateTicks.length-1, 0, timelineWidth);
                if (i == dateTicks.length - 1) {
                    x = timelineWidth - 30;
                }
                var year = moment(date).format('YYYY')
                var label = '';
                if (prevYear != year) {
                    label = year;
                    prevYear = year;
                }
                return E('text', { x: x, y: timelineHeight - 50, key: 'year-' + i }, label);
            }));

            var nowX = remap(Date.now(), startDate, endDate, 0, timelineWidth);
            timelineItems = timelineItems.concat([
                E('line', { key: 'tick', x1: nowX, y1: 0, x2: nowX, y2: timelineHeight - 30, stroke: 'rgba(255,255,255,0.5)'})
            ])

            console.log('timelineItems', timelineItems)

            panels = current.ch.map(function(child) {
                var items = [];
                if (child.ch) {
                    items = child.ch.filter(function(item) {
                        return item.cp === undefined;
                    })
                    items = items.map(function(item) {
                        var itemStyle = {};
                        if (item.nm.indexOf('@next') != -1) { itemStyle.background = 'rgba(100, 200, 0, '+0.2+')'; }
                        if (item.nm.indexOf('@due') != -1 && !item.cp) { itemStyle.background = 'rgba(255, 100, 0, 0.5)' }
                        if (item.nm.indexOf('<b>') != -1 && !item.cp) { itemStyle.fontWeight = 'bold' }
                        return E('li', { className: 'item', key: item.id, style: itemStyle },
                            E('p', { onClick: function(e) { self.onItemClick(e, item)}},
                                E('a', { className: item.cp ? 'completed' : '', href: 'https://workflowy.com/#/' + item.id, onClick: function(e) { return self.onItemLinkClick(e, item); }},
                                    normalizeName(item.nm)
                                )
                            )
                        )
                    });
                }
                return E('div', { className: 'panel', key: child.id },
                    E('h2', { onClick: function(e) { self.onItemClick(e, child)}},
                        E('a', { onClick: function(e) { return self.onItemLinkClick(e, child); } },
                            normalizeName(child.nm)
                        )
                    ),
                    E('ul', { style: { maxHeight: Math.floor(window.innerHeight - 8 * rem) + 'px'}}, items)
                )
            })
        }

        var workload = E('div', { className: 'workload' },
            this.state.weeksItems.map(function(week, index) {
                var title = index ? 'This Week' : 'Prev Week';
                return [
                    E('h1', {}, title),
                    E('ul', {},
                      week.map(function(project) {
                          return E('li', {}, E('span', { className: 'name'}, project.name), ' ', project.duration);
                      })
                    )
                ]
            })
        );

        var parentStack = [];
        var parent = current;
        parentStack.unshift(parent);
        while(parent.parent) {
            parent = parent.parent;
            parentStack.unshift(parent);
        }
        return E('div', { style: { width: (rem + panels.length * panelWidth) + 'px'}},
            E('H1', null,
                parentStack.map(function(parent, index) {
                    return [index > 0 ? ' / ' : '', E('a', { onClick: function(e) { self.showItem(parent)}, key: 'parent-'+parent.id}, parent.nm)];
                })),
            E('svg', { id:'timeline', width: timelineWidth, height: timelineHeight}, timelineItems),
            workload,
            panels
        );
    }
});

getJSON(document.location.origin + '/data', function(err, data) {
    if (err) {
        console.log(err);
        return;
    }
    ReactDOM.render(
        React.createElement(App, {data: data}),
        document.getElementById('container')
    );
})
