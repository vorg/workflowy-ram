function getText(url, callback) {
    var r = new XMLHttpRequest();
    r.open("GET", url, true);
    r.onreadystatechange = function () {
        if (r.readyState != 4 || r.status != 200) return;
        callback(null, r.responseText);
    };
    r.send("");
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
            root: { ch: this.props.data, nm: "Workflowy" }
        };
    },
    render: function() {
        console.log(this.state.root)
        return React.createElement("div", null, "Hello ", this.state.root.nm);
    }
});

getJSON(document.location.href + 'data', function(err, data) {
    ReactDOM.render(
        React.createElement(App, {data: data}),
        document.getElementById('container')
    );
})
