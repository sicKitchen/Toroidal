var toroidal = {
    // EDIT SIZE AND SHAPE
    N : 100,    // number of spine samples
    M : 10,     // numbers of samples in tube cross section
    a : 2,      // big radii
    b : 1,      // small radii
    p : 2,      // how many times curve winds around origin
    q : 5, 	    // number of times the curve coils around torus
    R : 0.4,    // tube radius
    r : 0.4,    // Used for hedgehog 'quill' length

    verts : null,
    normals : null,

    // line 2
    x : function(t){
        // x(t) = (a + b cos(qt)) cos(pt)
        return (this.a + this.b * Math.cos(this.q*t)) * Math.cos(this.p*t);
    },
    // line 3
    y : function(t){
        // y(t) = (a + b cos(qt)) sin(pt)
        return (this.a + this.b * Math.cos(this.q*t)) * Math.sin(this.p*t);
    },
    // line 4
    z : function(t){
        // z(t) = b sin(qt)
        return this.b * Math.sin(this.q*t);
    },
    // line 6
    dx : function(t){
        // dx(t) = -p y(t) - bq sin(qt) cos(pt)
        return -1*this.p * this.y(t) - this.b*this.q * Math.sin(this.q*t) * Math.cos(this.p*t);
    },
    // line 7
    dy : function(t){
        // dy(t) = p x(t) - bq sin(qt) sin(pt)
        return this.p * this.x(t) - this.b*this.q * Math.sin(this.q*t) * Math.sin(this.p*t);
    },
    // line 8
    dz : function(t){
        // dz(t) = bq cos(qt)
        return this.b*this.q * Math.cos(this.q*t);
    },
    // line 10
    ddx : function(t){
        // ddx(t) = -p dy(t) + bq(p sin(qt) sin(pt) - q cos(qt) cos(pt))
        return -1*this.p * this.dy(t) + this.b*this.q * (this.p * Math.sin(this.q*t) *
            Math.sin(this.p*t) - this.q * Math.cos(this.q*t) * Math.cos(this.p*t));
    },
    // line 11
    ddy : function(t){
        // ddy(t) = p dx(t) - bq(p sin(qt) cos(pt) + q cos(qt) sin(pt))
        return this.p * this.dx(t) - this.b*this.q * (this.p * Math.sin(this.q*t) *
            Math.cos(this.p*t) + this.q * Math.cos(this.q*t) * Math.sin(this.p*t));
    },
    // line 12
    ddz : function(t){
        var q_square = this.q * this.q;
        // ddz(t) = -q^2 b sin(qt)
        return -1*q_square * this.b * Math.sin(this.q*t);
    },

    // Figure 4 from assignment
    createGeometry : function() {
        this.verts = new Float32Array((this.N+1)*(this.M+1)*3);
        this.normals = new Float32Array((this.N+1)*(this.M+1)*3);
        var n = 0;
        var dt = 2*Math.PI/this.N, du = 2*Math.PI/this.M;
        for (var i = 0, t = 0.0; i <= this.N; i++, t += dt) {
            if (i == this.N) t == 0.0; // wrap around
            var C = [this.x(t), this.y(t), this.z(t)];
            var T = [this.dx(t), this.dy(t), this.dz(t)];
            var A = [this.ddx(t), this.ddy(t), this.ddz(t)];
            var B = cross3(T, A);
            norm3(T);
            norm3(B);
            var N_ = cross3(B,T);
            for (var j = 0, u = 0.0; j <= this.M; j++, u += du) {
                if (j == this.M) u = 0.0; // wrap around
                var cosu = Math.cos(u), sinu = Math.sin(u);
                for (var k = 0; k < 3; k++) {
                    this.normals[n] = cosu*N_[k] + sinu*B[k];
                    this.verts[n] = C[k] + this.R*this.normals[n];
                    n++;
                }
            }
        }
    },

    triangleStrip: null,

    // Figure 7 from assignment
    createTriangleStrip : function() {
        var M = this.M, N = this.N;
        var numIndices = N*(M+2)*2 - 2;
        if (!this.triangleStrip || this.triangleStrip.length != numIndices)
            this.triangleStrip = new Uint16Array(numIndices);
        var index = function(i, j) {
            return i*(M+1) + j;
        }
        var n = 0;
        for (var i = 0; i < N; i++) {
            if (i > 0)  // degenerate connecting index
                this.triangleStrip[n++] = index(i,0);
            for (var j = 0; j <= M; j++) {
                this.triangleStrip[n++] = index(i,j);
                this.triangleStrip[n++] = index(i+1,j);
            }
            if (i < N-1) // degenerate connecting index
                this.triangleStrip[n++] = index(i+1,M)
        }
    },

    wireframe : null, // Uint16Array  (line indices)

    createWireFrame : function() {
        var lines = [];
        lines.push(this.triangleStrip[0], this.triangleStrip[1]);
        var numStripIndices = this.triangleStrip.length;
        for (var i = 2; i < numStripIndices; i++) {
            var a = this.triangleStrip[i-2];
            var b = this.triangleStrip[i-1];
            var c = this.triangleStrip[i];
            if (a != b && b != c && c != a)
                lines.push(a, c, b, c);
        }
        this.wireframe = new Uint16Array(lines);
    },

    numHedgeHogElements : 0,
    hedgeHog : null,  // Float32Array of lines

    createHedgeHog : function() {
        var lines = [];
        var hedgeHogLength = 0.5*this.r;
        var numNormals = this.normals.length;
        for (var i = 0; i < numNormals; i += 3) {
            var p = [this.verts[i], this.verts[i+1], this.verts[i+2]];
            var n = [this.normals[i], this.normals[i+1], this.normals[i+2]];
            var q = [p[0] + hedgeHogLength*n[0],
                p[1] + hedgeHogLength*n[1],
                p[2] + hedgeHogLength*n[2]];
            lines.push(p[0], p[1], p[2],
                q[0], q[1], q[2]);
        }
        this.numHedgeHogElements = lines.length/3;
        this.hedgeHog = new Float32Array(lines);
    }

};

