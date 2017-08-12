class Struct {
    constructor() {
        this.fields = {};
        this.sizeof = 0;
    }
    push(name, size) {
        this.fields[name] = {
            size: size,
            offset: this.sizeof
        }
        this.sizeof += size;
    }
}

class MemoryMapping {
    constructor(proto) {
        this.proto = proto;
        this.consts = proto.const;
        this.sizes = proto.sizeof;
        this.structs = {};
        for (var i in proto.proto) {
            this.struct('proto.' + i);
        }
        for (var i in proto.user) {
            this.struct('user.' + i);
        }
    }
    struct(name) {
        console.log('struct(', name, ')');
        if (this.structs[name]) {
            return this.structs[name];
        } else {
            var s = name.split('.');
            var o = this.proto;
            for (var i in s) {
                o = o[s[i]];
            }
            this.structs[name] = this.makeStruct(o);
            return this.structs[name];
        }
    }
    const(val) {
        if (typeof val == 'number') return val;
        return this.consts[val];
    }
    sizeof(obj) {
        var type = obj.type;
        var count = 1;
        if (type.indexOf('[]') > 0) {
            type = type.substr(0, type.length - 2);
            count = this.const(obj.size);
        }
        if (this.sizes[type]) {
            return this.sizes[type] * count;
        }
        return this.struct(type).sizeof * count;
    }
    makeStruct(array) {
        var s = new Struct();
        for (var i = 0; i < array.length; i++) {
            var o = array[i];
            s.push(o.name, this.sizeof(o));
        }
        return s;
    }
}

module.exports = MemoryMapping;
