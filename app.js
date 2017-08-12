var m = require('./memory.json');
var MemoryMapping = require('./shmap');
var util = require('util');

var mm = new MemoryMapping(m);

for (var s in mm.structs) {
    var o = mm.structs[s];
    console.log('\nstruct', s, ':', o.sizeof);
    for (var f in o.fields) {
        console.log(`\t+${o.fields[f].offset}\t(${o.fields[f].size})\t${f}`)
    }
}
