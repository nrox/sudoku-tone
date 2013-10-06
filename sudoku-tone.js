var FONT = "Chewy";
var TYPE_EMPTY = "empty";
var TYPE_FILLED = "filled";
var TYPE_CHOICE = "choice";
var CANVAS = "#canvas";
var SPARSE = 4 / 5;
var WIDTH = 500;
var HEIGHT = Math.round(WIDTH * 1.2);
var MARGIN_X = 70;
var MARGIN_Y = Math.round(MARGIN_X * 1.618);
var rows = 3;
var CW = 40;
var DCW = Math.round(CW / 8);
var ctx;
var cells = [];
var eventMemo = {};
var COLOR = {
    "back": "#feb",
    "square": "#ffe",
    "empty": "#898",
    "filled": "black",
    "error": "#c22",
    "delete": "#ddd",
    "move": "#337",
    "choice": "#337"
};
var record = false;

var UX_ACTIONS = [];
var UX_INITIAL;

function recordUX(e) {
    if (!record) return;
    //we dont want to record again
    if (!e || e["UX_ACTIONS"]) return;
    if (!UX_INITIAL) {
        UX_INITIAL = JSON.parse(JSON.stringify(cells));
    }
    var obj = {};
    obj["UX_ACTIONS"] = true;
    obj["time"] = (new Date()).getTime();
    var props = ["type", "offsetX", "offsetY"];
    props.map(function (p) {
        obj[p] = e[p];
    });
    UX_ACTIONS.push(obj);
}

function drawCursor(e) {
    ctx.save();
    ctx.fillStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeStle = "black";
    ctx.beginPath();
    ctx.arc(e.offsetX, e.offsetY, eventMemo.down ? 5 : 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function playUX(lastTime) {
    if (UX_ACTIONS.length == 0) {
        UX_INITIAL = null;
        return;
    }
    var ux = UX_ACTIONS.shift();
    if (!lastTime) {
        cells = UX_INITIAL;
        lastTime = ux.time;
    }
    var timeout = ux.time - lastTime;
    var event = JSON.stringify(ux);
    setTimeout("a_" + ux.type + "(" + event + ");drawCursor(" + event + ");playUX(" + ux.time + ");", timeout);
}

function centerText(text, x, y, width, height, context) {
    var h = height;
    context.font = h + "px " + FONT;
    var dx = 0;
    var margin = 2;
    var tw = context.measureText(text).width;
    while ((tw + margin * 2) > width) {
        h--;
        context.font = h + "px " + FONT;
        tw = context.measureText(text).width;
    }
    dx = (width - tw) / 2;
    context.textBaseline = "middle";
    context.fillText(text, Math.round(x + dx), Math.round(y + height / 2 + 1));
}

function makeSudokuGrid(s) { /* parse from lisp array */
    //Generate a complete puzzle
    var grid = CU.Sudoku.generate();
    //console.log(grid.rows);
    //Clear s cells from the puzzle
    //CU.Sudoku.cull(grid, s);
    return grid.rows
}

var sudoku = makeSudokuGrid(60);

var soundMap = {
    1: [60],
    2: 62,
    3: 64,
    4: [65],
    5: [67],
    6: 69,
    7: 71,
    8: 72,
    9: 74
};

var soundFrequency = {
    60: 261.63,
    62: 293.67,
    64: 329.63,
    65: 349.23,
    67: 392.00,
    69: 440.00,
    71: 493.88,
    72: 523.25,
    74: 587.33
};

var displayMap = {
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9"
};

/*
 displayMap = {
 1: "CMaj",
 2: "D",
 3: "E",
 4: "F",
 5: "G",
 6: "Ab",
 7: "B",
 8: "c",
 9: "D8"
 };
 */

function play(cell) {
    if (!cell || !cell.number || !cell.play) {
        return;
    }
    try {
        var sounds = soundMap[cell.number];
        if (!(sounds instanceof Array)) {
            sounds = [sounds];
        }
        sounds.map(function (n) {
            startTone(soundFrequency[n]);
        });
        setTimeout(stopTone, 75);
    } catch (e) {
        alert(e);
    }
}

function overObject(e) {
    var x = e["offsetX"];
    var y = e["offsetY"];
    var obj;
    cells.map(function (o) {
        if (o["x"] < x && o["x+"] > x && o["y"] < y && o["y+"] > y) {
            obj = o;
        }
    });
    return obj;
}

function quarter(h) {
    return 3 * Math.floor(h.row / 3) + Math.floor(h.col / 3);
}

function sameCell(h2, h1) {
    return h1 && h2 && h1.col == h2.col && h1.row == h2.row;
}

function mayInterfere(h1, h2) {
    if (!h1 || !h2
        || !h1.display || !h2.display
        || h1.type == TYPE_CHOICE || h2.type == TYPE_CHOICE
        || sameCell(h1, h2)) {
        return false;
    }
    if (h1.row == h2.row || h1.col == h2.col || quarter(h1) == quarter(h2)) {
        return true;
    }
    return false;
}

function collide(h1, h2) {
    return mayInterfere(h1, h2) && h1.number == h2.number;
}

function isValid(h1) {
    for (var index in cells) {
        var cell = cells[index];
        if (!sameCell(cell, h1) && collide(cell, h1)) {
            return false;
        }
    }
    return true;
}

function colorize(h) {
    if (h && !isValid(h) && h.type == TYPE_EMPTY) {
        h.color = COLOR.error;
    } else if (h) {
        h.color = h.defaultColor;
    }
}

function setProps(obj, props) {
    for (var p in props) {
        if (p) obj[p] = props[p];
    }
}

function dropOut(from, to) {
    if (!to && from && from.type == TYPE_EMPTY) {
        from.display = false;
        from.number = from.truenumber;
        from.drag = false;
        return true;
    }
    return false;
}

function dropIn(from, to) {
    if (to && from && to.type == TYPE_EMPTY) {
        to.number = from.number;
        to.display = true;
        to.drag = true;
        return true;
    }
    return false;
}

function dragIn(from, to) {
    if (from && to && !sameCell(to, from) && from.type == TYPE_EMPTY && to.type == TYPE_FILLED) {
        from.display = false;
        from.number = from.truenumber;
        from.drag = false;
        return true;
    } else if (from && to && !sameCell(to, from) && from.type == TYPE_EMPTY && to.type == TYPE_EMPTY) {
        from.display = false;
        from.number = from.truenumber;
        from.drag = false;
        return true;
    }
    return false;
}

function changeTarget(to, from) {
    if (dropIn(from, to)) return;
}

function changeSource(to, from) {
    if (dropOut(from, to)) return;
    if (dragIn(from, to)) return;
}

function a_mousemove(e) {
    recordUX(e);
    redrawSudoku();
    var cell = eventMemo["mousedown"];
    if (!cell) {
        return;
    }
    var x = e["offsetX"],
        y = e["offsetY"];
    var dx = eventMemo.dx,
        dy = eventMemo.dy;
    var obj = overObject(e);
    var color = obj ? COLOR.move : (cell.type == TYPE_EMPTY ? COLOR.delete : COLOR.move);
    ctx.save();
    ctx.beginPath();
    ctx.textBaseline = "top";
    ctx.font = CW + "px Calibri";
    ctx.fillStyle = color;
    centerText(displayMap[cell.number], x + dx, y + dy, CW, CW, ctx);
    ctx.stroke();
    ctx.restore();
}

function a_mousedown(e) {
    recordUX(e);
    redrawSudoku();
    eventMemo["down"] = true;
    eventMemo["mousedown"] = null;
    eventMemo["dx"] = 0;
    eventMemo["dy"] = 0;
    var cell = overObject(e);
    if (cell && cell.drag) {
        eventMemo["mousedown"] = cell;
        var x = e["offsetX"],
            y = e["offsetY"];
        var dx = cell.x - x,
            dy = cell.y - y;
        eventMemo["dx"] = dx;
        eventMemo["dy"] = dy;
    }
    play(cell);
}

function a_mouseup(e) {
    recordUX(e);
    var hDrop = overObject(e);
    var hDrag = eventMemo["mousedown"];
    changeTarget(hDrop, hDrag);
    changeSource(hDrop, hDrag);
    colorize(hDrop);
    colorize(hDrag);
    eventMemo["down"] = false;
    eventMemo["mousedown"] = null;
    eventMemo["dx"] = 0;
    eventMemo["dy"] = 0;
    redrawSudoku();
}


function makeLines() {
    ctx.save();
    ctx.fillStyle = COLOR.back;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = COLOR.square;
    ctx.fillRect(MARGIN_X, MARGIN_Y, CW * rows * 3, CW * rows * 3);
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (var i = 0; i <= rows * 3; i += 3) {
        ctx.moveTo(MARGIN_X + 0, i * CW + MARGIN_Y);
        ctx.lineTo(MARGIN_X + rows * CW * 3, i * CW + MARGIN_Y);
        ctx.moveTo(MARGIN_X + i * CW, 0 + MARGIN_Y);
        ctx.lineTo(MARGIN_X + i * CW, rows * CW * 3 + MARGIN_Y);
    }
    ctx.stroke();
    ctx.restore();
}

function makeCell(i, j, number, cell) {
    if (!cell) {
        var isChoice = i < 0 ? true : false;
        if (isChoice) i = 3 * 3 + Math.abs(i);
        var x = j * CW + MARGIN_X,
            y = i * CW + MARGIN_Y;
        var display = Math.random() > SPARSE;
        var color = display ? COLOR.filled : COLOR.empty;
        var type = display ? TYPE_FILLED : TYPE_EMPTY;
        var play = display ? false : true;
        if (isChoice) {
            type = TYPE_CHOICE;
            color = COLOR.choice;
            display = true;
            play = true;
        }
        cell = {
            "row": i,
            "col": j,
            "x": x,
            "y": y,
            "x+": (x + CW),
            "y+": (y + CW),
            "number": number,
            "truenumber": number,
            "type": type,
            "display": display,
            "color": color,
            "defaultColor": color,
            "drop": !display,
            "drag": display,
            "play": true || play
        };
    }
    cells.push(cell);
    return cell;
}

function drawCell(cell) {
    var x = cell.x,
        y = cell.y;
    var style = ctx.fillStyle;
    ctx.fillStyle = cell.color;
    ctx.lineCap = "square";
    ctx.beginPath();
    if (cell.type != TYPE_CHOICE) {
        ctx.rect(x, y, CW, CW);
    }
    if (cell.display) {
        centerText(displayMap[cell.number], x, y, CW, CW, ctx);
    }
    ctx.stroke();
    ctx.fillStyle = style;
}

function redrawSudoku() {
    makeLines();
    cells.map(drawCell);
}

function test() {
    playUX();
};

$(document).ready(function () {
    //appedn canvas
    $("body").append($("<canvas>").attr({
        "id": CANVAS.substr(1),
        "class": "board"
    }));

    ctx = $(CANVAS)[0].getContext("2d");

    $(CANVAS).attr({
        "height": HEIGHT,
        "width": WIDTH
    });
    // assign events
    $(CANVAS).mousemove(function (e) {
        a_mousemove(e);
    });
    $(CANVAS).mousedown(function (e) {
        a_mousedown(e);
    });
    $(CANVAS).mouseup(function (e) {
        a_mouseup(e);
    });

    //make cells
    for (var i = 0; i < sudoku.length; i++) {
        for (var j = 0; j < sudoku[i].length; j++) {
            makeCell(i, j, sudoku[i][j]);
        }
    }
    for (var j = 0; j < sudoku[0].length; j++) {
        makeCell(-1, j, j + 1);
    }
    redrawSudoku();
    setTimeout("redrawSudoku();", 100);
});

