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
        this.showItem(child);
        return false;
    },
    showItem: function(item) {
        localStorage.currentId = item.id;
        this.setState({ current: item })
    },
    render: function() {
        var rem = 16; //16px
        var panelWidth = (18 + 0.5) * rem;
        var current = this.state.current;
        var panels = [];
        var self = this;

        function normalizeName(str) {
            str = str.replace(/^[0-9]{6}/,'')
            //str = str.replace(/#[^ ]+/g,'')
            //str = str.replace(/@[^ ]+/g,'')
            str = str.replace(/-/g, ' ')

            str = str.split(' ');
            str = str.map(function(s) {
                s += ' ';
                if (s[0] == '#' || s[0] == '@') {
                    return E('span', { className: 'tag' }, s);
                }
                return s;
            })

            return str;
        }

        if (current.ch) {
            panels = current.ch.map(function(child) {
                var items = [];
                if (child.ch) {
                    items = child.ch.map(function(item) {
                        return E('li', { className: 'item', key: item.id },
                            E('p', null, E('a', { className: item.cp ? 'completed' : '', onClick: function(e) { self.onItemClick(e, item)}}, normalizeName(item.nm))),
                            E('a', {className: 'outLink'}, '>')
                        )
                    });
                }
                return E('div', { className: 'panel', key: child.id },
                    E('h2', null, E('a', { onClick: function(e) { self.onItemClick(e, child)}}, normalizeName(child.nm))),
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
                    return [index > 0 ? ' / ' : '', E('a', { onClick: function(e) { self.showItem(parent)}}, parent.nm)];
                })),
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
