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
        if (err) callback(err, data);
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
        return {
            root: { ch: this.props.data, nm: 'Workflowy' }
        };
    },
    render: function() {
        var rem = 16; //16px
        var panelWidth = (18 + 0.5) * rem;
        var root = this.state.root;
        var panels = [];
        if (root.ch) {
            panels = root.ch.map(function(child) {
                var items = [];
                if (child.ch) {
                    items = child.ch.map(function(child) {
                        return E('li', { className: 'item' },
                            E('p', null, child.nm)
                        )
                    });
                }
                return E('div', { className: 'panel' },
                    E('h2', null, child.nm),
                    E('ul', { style: { maxHeight: Math.floor(window.innerHeight - 8 * rem) + 'px'}}, items)
                )
            })
        }
        return E('div', { style: { width: (rem + panels.length * panelWidth) + 'px'}},
            E('H1', null, 'Hello ', root.nm),
            panels
        );
    }
});

getJSON(document.location.href + 'data', function(err, data) {
    ReactDOM.render(
        React.createElement(App, {data: data}),
        document.getElementById('container')
    );
})
