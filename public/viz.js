var E = React.createElement;

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

function prop(name) {
    return function(o) {
        return o[name];
    }
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

var App = React.createClass({
    getInitialState: function() {
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
            current: current
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
    onItemLinkClick: function(e, child) {
        e.preventDefault();
        e.stopPropagation();
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
            var timespan = item.nm.match(/@timespan\(([^\)]+)\)/)[1];
            if (!timespan) {
                console.log('invalid @timespan', item.nm)
                return null;
            }
            var dates = timespan.split('..');
            var start = (dates[0].length == 10) ? moment(dates[0], 'YYYY-MM-DD').toDate() : moment(dates[0], 'YYMMDD').toDate()
            var end = (dates[1].length == 10) ? moment(dates[1], 'YYYY-MM-DD').toDate() : moment(dates[1], 'YYMMDD').toDate()
            return [item, start, end];
        }

        function extractMaybe(item) {
            var maybe = item.nm.match(/@maybe\(([^\)]+)\)/)[1];
            if (!maybe) {
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

            var datesRange = []
                .concat(timespans.map(prop('1')))
                .concat(timespans.map(prop('2')))
                .concat(dueDates.map(prop('1')))
                .map(dateToTime)
            var startDate = datesRange.reduce(min, Date.now())
            var endDate = datesRange.reduce(max, Date.now())

            var h = 12;

            timelineItems = timelineItems.concat(maybes.map(function(maybe, i) {
                var start = maybe[1].getTime()
                var end = maybe[2].getTime()
                var sx = remap(start, startDate, endDate, 0, timelineWidth)
                var ex = remap(end, startDate, endDate, 0, timelineWidth)

                var margin = 2
                var y = timelineHeight;
                timelineHeight += h + margin
                return E('rect', { key: 'timespan-'+i, fill: 'rgba(255, 200, 0, 0.5)', x: sx, y: y, width: ex - sx, height: h},
                    E('title', {}, maybe[0].parent.nm + '\n' + maybe[0].nm)
                )
            }))

            timelineItems = timelineItems.concat(timespans.map(function(timespan, i) {
                var start = timespan[1].getTime()
                var end = timespan[2].getTime()
                var sx = remap(start, startDate, endDate, 0, timelineWidth)
                var ex = remap(end, startDate, endDate, 0, timelineWidth)

                var margin = 2
                var y = timelineHeight;
                timelineHeight += h + margin
                return E('rect', { key: 'timespan-'+i, fill: 'rgba(255, 200, 0, 1)', x: sx, y: y, width: ex - sx, height: h},
                    E('title', {}, timespan[0].parent.nm + '\n' + timespan[0].nm)
                )
            }))

            var dueDatesHeight = 0;
            timelineItems = timelineItems.concat(dueDates.map(function(dueDate, i) {
                var start = dueDate[1].getTime()
                var sx = remap(start, startDate, endDate, 0, timelineWidth)
                var ex = sx + 10
                var margin = 2
                var y = dueDatesHeight;
                dueDatesHeight += h + margin
                return E('rect', { key: 'due-'+i, fill: 'rgba(255, 50, 0, 1)', x: sx, y: y, width: ex - sx, height: h},
                    E('title', {}, dueDate[0].parent.nm + '\n' + dueDate[0].nm)
                )
            }))

            var dateTicks = []
            var startWeek = moment(startDate).startOf('isoweek');
            var endWeek = moment(endDate).startOf('isoweek').add(1, 'week');

            while(startWeek.toDate().getTime() < endWeek.toDate().getTime()) {
                dateTicks.push(startWeek.clone().toDate())
                startWeek = startWeek.add(1, 'week');
            }

            timelineHeight = Math.max(timelineHeight, dueDatesHeight)
            timelineHeight += 50 //bottom padding

            timelineItems = timelineItems.concat(dateTicks.map(function(date, i) {
                var x = remap(i, 0, dateTicks.length-1, 0, timelineWidth);
                if (i == dateTicks.length - 1) {
                    x = timelineWidth - 30;
                }
                var date = moment(date).format('Do')
                return E('text', { x: x, y: timelineHeight - 10 }, date);
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
                return E('text', { x: x, y: timelineHeight - 30 }, label);
            }));

            var nowX = remap(Date.now(), startDate, endDate, 0, timelineWidth);
            timelineItems = timelineItems.concat([
                E('line', { x1: nowX, y1: 0, x2: nowX, y2: timelineHeight - 30, stroke: 'rgba(255,255,255,0.5)'})
            ])


            console.log(timelineItems)

            panels = current.ch.map(function(child) {
                var items = [];
                if (child.ch) {
                    items = child.ch.filter(function(item) {
                        return item.cp === undefined;
                    })
                    items = items.map(function(item) {
                        var itemStyle = {};
                        if (item.nm.indexOf('@next') != -1) { itemStyle = { background: 'rgba(100, 200, 0, '+0.2+')' }}
                        if (item.nm.indexOf('@due') != -1 && !item.cp) { itemStyle = { background: 'rgba(255, 100, 0, 0.5)' }}
                        return E('li', { className: 'item', key: item.id, style: itemStyle },
                            E('p', { onClick: function(e) { self.onItemClick(e, item)}},
                                E('a', { className: item.cp ? 'completed' : '', href: 'https://workflowy.com/#/' + item.id, onClick: this.onItemLinkClick},
                                    normalizeName(item.nm)
                                )
                            )
                        )
                    });
                }
                return E('div', { className: 'panel', key: child.id },
                    E('h2', { onClick: function(e) { self.onItemClick(e, child)}},
                        E('a', { href: 'https://workflowy.com/#/' + child.id, onClick: this.onItemLinkClick },
                            normalizeName(child.nm)
                        )
                    ),
                    E('ul', { style: { maxHeight: Math.floor(window.innerHeight - 8 * rem) + 'px'}}, items)
                )
            })
        }
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
