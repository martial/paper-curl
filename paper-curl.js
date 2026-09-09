/*! PaperCurl v0.2.1 | SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Martial Geoffre-Rouland
 * A small editable HTML page-curl library. No build step or dependencies.
 * Public API and usage: see README.md.
 */
(function (global) {
  "use strict";
  /* A welded, continuously curved sheet. Native HTML remains the resting surface. */
  class SheetRenderer {
    constructor(host, options) {
      this.designWidth = options.width;
      this.designHeight = options.height;
      this.curl = options.curl;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "pc-curl";
      this.canvas.hidden = true;
      this.canvas.setAttribute("aria-hidden", "true");
      host.append(this.canvas);
      const gl = (this.gl = this.canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      }));
      if (!gl) throw new Error("WebGL is unavailable");
      this.cols = 112;
      this.rows = 32;
      this.vertices = new Float32Array((this.cols + 1) * (this.rows + 1) * 8);
      const indices = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const a = r * (this.cols + 1) + c,
            b = a + this.cols + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      this.count = indices.length;
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
      this.indices = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW,
      );
      this.sheet = this.program(
        `
   attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;
   uniform float uShadow;uniform vec2 uView;uniform float uPageWidth;varying vec2 vUV;varying vec3 vNormal;varying float vHeight;
   void main(){
    vec3 p=aPosition;
    if(uShadow>0.5){p.xy+=vec2(.16,.18)*p.z;p.z=0.;}
    else {p.x*=1.+p.z/(uPageWidth*7.78);p.y-=p.z*.055;}
    gl_Position=vec4(p.x/uView.x,-p.y/uView.y,-p.z/(uPageWidth*2.22),1.);
    vUV=aUV;vNormal=aNormal;vHeight=aPosition.z;
   }`,
        `
   precision highp float;
   uniform sampler2D uFront;uniform sampler2D uBack;
   uniform float uShadow;uniform float uPageWidth;uniform float uLift;uniform float uDetails;
   varying vec2 vUV;varying vec3 vNormal;varying float vHeight;
   void main(){
    if(uShadow>.5){gl_FragColor=vec4(0.,0.,0.,.22-clamp(vHeight/uPageWidth,0.,1.)*.12);return;}
    vec3 normal=normalize(vNormal)*(gl_FrontFacing?1.:-1.);
    vec3 ink=gl_FrontFacing?texture2D(uFront,vUV).rgb:texture2D(uBack,vec2(1.-vUV.x,vUV.y)).rgb;
    vec3 light=normalize(vec3(-.35,-.45,1.));
    float lambert=max(0.,dot(normal,light));
    float shade=(.66+.34*lambert)/(.66+.34*light.z);
    float satin=pow(max(0.,dot(normal,normalize(light+vec3(0.,0.,1.)))),24.)*.065;
    vec3 color=ink*mix(1.,shade,uDetails*uLift)+satin*uDetails*uLift;
    color*=1.-uDetails*.055*exp(-vUV.x*vUV.x*500.);
    gl_FragColor=vec4(color,1.);
   }`,
      );
      this.blur = this.program(
        `
   attribute vec2 aPoint;varying vec2 vUV;
   void main(){vUV=aPoint*.5+.5;gl_Position=vec4(aPoint,0.,1.);}
  `,
        `
   precision highp float;uniform sampler2D uImage;uniform vec2 uStep;varying vec2 vUV;
   void main(){
    vec4 color=texture2D(uImage,vUV)*.227027;
    color+=texture2D(uImage,vUV+uStep*1.384615)*.316216;
    color+=texture2D(uImage,vUV-uStep*1.384615)*.316216;
    color+=texture2D(uImage,vUV+uStep*3.230769)*.070270;
    color+=texture2D(uImage,vUV-uStep*3.230769)*.070270;
    gl_FragColor=color;
   }`,
      );
      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      this.targets = [this.target(), this.target()];
      this.textures = [];
      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.CULL_FACE);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    program(vs, fs) {
      const gl = this.gl,
        program = gl.createProgram();
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vs],
        [gl.FRAGMENT_SHADER, fs],
      ]) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program, shader);
        gl.deleteShader(shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program));
      const uniforms = {};
      for (
        let i = 0;
        i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        i++
      ) {
        const name = gl.getActiveUniform(program, i).name;
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      return { program, uniforms };
    }
    texture(source = null) {
      const gl = this.gl,
        t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (source)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source,
        );
      return t;
    }
    target() {
      const gl = this.gl,
        texture = this.texture();
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        512,
        512,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      return { texture, framebuffer };
    }
    setPages(front, back, width, height) {
      const gl = this.gl;
      this.clear();
      this.textures = [this.texture(front), this.texture(back)];
      const dpr = Math.min(devicePixelRatio || 1, 1.8);
      this.canvas.width = Math.round(width * 3 * dpr);
      this.canvas.height = Math.round(height * 2 * dpr);
      this.canvas.hidden = false;
    }
    geometry(progress, corner) {
      const cols = this.cols,
        rows = this.rows,
        data = this.vertices,
        lift = Math.sin(Math.PI * progress),
        curl = this.curl * lift;
      for (let r = 0; r <= rows; r++) {
        const v = r / rows,
          bend = curl * (1 + corner * 0.28 * (v - 0.5));
        const base =
          Math.PI * progress -
          curl * (0.38 + 0.08 * progress) +
          corner * 0.09 * lift * (v - 0.5);
        for (let c = 0; c <= cols; c++) {
          const u = c / cols,
            angle = base + bend * u,
            index = (r * (cols + 1) + c) * 8;
          data[index] =
            this.designWidth *
            (bend < 0.0001
              ? u * Math.cos(base)
              : (Math.sin(angle) - Math.sin(base)) / bend);
          data[index + 1] = (v - 0.5) * this.designHeight;
          data[index + 2] = Math.max(
            0,
            this.designWidth *
              (bend < 0.0001
                ? u * Math.sin(base)
                : (Math.cos(base) - Math.cos(angle)) / bend),
          );
          data[index + 6] = u;
          data[index + 7] = v;
        }
      }
      for (let r = 0; r <= rows; r++)
        for (let c = 0; c <= cols; c++) {
          const i = (r * (cols + 1) + c) * 8,
            prev = (r * (cols + 1) + Math.max(0, c - 1)) * 8,
            next = (r * (cols + 1) + Math.min(cols, c + 1)) * 8;
          const top = (Math.max(0, r - 1) * (cols + 1) + c) * 8,
            bottom = (Math.min(rows, r + 1) * (cols + 1) + c) * 8;
          const ux = data[next] - data[prev],
            uz = data[next + 2] - data[prev + 2];
          const vx = data[bottom] - data[top],
            vy = data[bottom + 1] - data[top + 1],
            vz = data[bottom + 2] - data[top + 2];
          const nx = -uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy,
            len = Math.hypot(nx, ny, nz) || 1;
          data[i + 3] = nx / len;
          data[i + 4] = ny / len;
          data[i + 5] = nz / len;
        }
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    attributes(program, quad = false) {
      const gl = this.gl;
      for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(i);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad ? this.quad : this.buffer);
      if (quad) {
        const loc = gl.getAttribLocation(program, "aPoint");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      } else
        for (const [name, size, offset] of [
          ["aPosition", 3, 0],
          ["aNormal", 3, 12],
          ["aUV", 2, 24],
        ]) {
          const loc = gl.getAttribLocation(program, name);
          if (loc < 0) continue;
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, offset);
        }
    }
    draw(progress, corner, details) {
      const gl = this.gl;
      if (!this.textures.length) return;
      this.geometry(progress, corner);
      const lift = Math.sin(Math.PI * progress);
      gl.useProgram(this.sheet.program);
      this.attributes(this.sheet.program);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
      gl.uniform2f(
        this.sheet.uniforms.uView,
        this.designWidth * 1.5,
        this.designHeight,
      );
      gl.uniform1f(this.sheet.uniforms.uPageWidth, this.designWidth);
      gl.uniform1f(this.sheet.uniforms.uShadow, 1);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[0].framebuffer);
      gl.viewport(0, 0, 512, 512);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (details)
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
      gl.useProgram(this.blur.program);
      this.attributes(this.blur.program, true);
      gl.uniform1i(this.blur.uniforms.uImage, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.targets[0].texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[1].framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(this.blur.uniforms.uStep, (1.2 + lift * 3.7) / 512, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, this.targets[1].texture);
      gl.uniform2f(this.blur.uniforms.uStep, 0, (1.2 + lift * 3.7) / 512);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.useProgram(this.sheet.program);
      this.attributes(this.sheet.program);
      gl.uniform1f(this.sheet.uniforms.uShadow, 0);
      gl.uniform1f(this.sheet.uniforms.uLift, lift);
      gl.uniform1f(this.sheet.uniforms.uDetails, details ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
      gl.uniform1i(this.sheet.uniforms.uFront, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
      gl.uniform1i(this.sheet.uniforms.uBack, 1);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
    clear() {
      const gl = this.gl;
      this.canvas.hidden = true;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const texture of this.textures || []) gl.deleteTexture(texture);
      this.textures = [];
    }
    dispose() {
      this.clear();
      const gl = this.gl;
      for (const target of this.targets) {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      }
      for (const buffer of [this.buffer, this.indices, this.quad])
        gl.deleteBuffer(buffer);
      gl.deleteProgram(this.sheet.program);
      gl.deleteProgram(this.blur.program);
      this.canvas.remove();
    }
  }

  /**
   * PaperCurl — a small, dependency-free book for ordinary HTML pages.
   * new PaperCurl('#book', { width: 450, height: 636, duration: 1150 });
   * next(), prev(), first(), last(), goTo(page), goToSpread(spread), prepare(), refresh(), destroy().
   * See README.md for the options, events, and content-editing examples.
   */
  const captureDefaults = new WeakMap();
  class PaperCurl {
    static defaults = {
      width: 450,
      height: 636,
      duration: 1150,
      curl: 1.72,
      showCover: true,
      startPage: 0,
      shadows: true,
      padding: 52,
      maxScale: 1,
      textureScale: 2,
      keyboard: true,
      preload: true,
      fontCSS: "",
      worker: false,
      onProgress: null,
      onChange: null,
      onError: null,
    };
    constructor(element, options = {}) {
      this.element =
        typeof element === "string" ? document.querySelector(element) : element;
      if (!this.element) throw new Error("PaperCurl: book element not found.");
      this.options = { ...PaperCurl.defaults, ...options };
      if (
        !(
          this.options.width > 0 &&
          this.options.height > 0 &&
          this.options.duration >= 0
        )
      )
        throw new Error(
          "PaperCurl: width and height must be positive; duration must be nonnegative.",
        );
      this.originalNodes = [...this.element.childNodes];
      this.originalTab = this.element.getAttribute("tabindex");
      this.originalRole = this.element.getAttribute("role");
      this.pages = [...this.element.children];
      if (!this.pages.length)
        throw new Error("PaperCurl: add at least one HTML page.");
      this.abort = new AbortController();
      this.cache = new Map();
      this.assets = new Map();
      this.fontCache = new Map();
      this.styleSheets = new Map();
      this.fontRules = null;
      this.pageStatus = new Map();
      this.preparations = new Set();
      this.preparationId = 0;
      this.assetWorker = null;
      this.workerFailed = false;
      this.workerJobs = new Map();
      this.workerId = 0;
      this.preloadTimer = 0;
      this.epoch = 0;
      this.current = 0;
      this.desired = 0;
      this.active = null;
      this.drag = null;
      this.loading = false;
      this.destroyed = false;
      this.raf = 0;
      this.dragRAF = 0;
      this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
      this.pairs = [];
      let start = 0;
      if (this.options.showCover) {
        this.pairs.push([null, 0]);
        start = 1;
      }
      for (let i = start; i < this.pages.length; i += 2)
        this.pairs.push([i, i + 1 < this.pages.length ? i + 1 : null]);
      this.rig = this._node("pc-rig");
      this.center = this._node("pc-center");
      this.book = this._node("pc-book");
      this.shadows = [
        this._node("pc-ground pc-left"),
        this._node("pc-ground pc-right"),
      ];
      this.center.append(...this.shadows, this.book);
      this.rig.append(this.center);
      this.wrappers = this.pages.map((page) => {
        const wrapper = this._node("pc-page"),
          content = this._node("pc-content");
        content.append(page);
        wrapper.append(content);
        this.book.append(wrapper);
        return wrapper;
      });
      this.element.append(this.rig);
      this.element.classList.add("pc-host");
      this.rig.style.setProperty("--pc-width", this.options.width + "px");
      this.rig.style.setProperty("--pc-height", this.options.height + "px");
      if (this.originalTab === null) this.element.tabIndex = 0;
      if (this.originalRole === null)
        this.element.setAttribute("role", "group");
      this.element.classList.toggle("pc-no-shadows", !this.options.shadows);
      this._size();
      this.current = this.desired = this._spreadFor(this.options.startPage);
      try {
        this.renderer = new SheetRenderer(this.center, this.options);
      } catch (error) {
        this.renderer = null;
        this.center.querySelector(".pc-curl")?.remove();
        this._error(error);
      }
      this._bind();
      this._rest();
      this.observer = new ResizeObserver(() => {
        if (!this.active && !this.loading && !this.drag) {
          this._size();
          this._center();
        }
      });
      this.observer.observe(this.element);
    }
    _node(name) {
      const element = document.createElement("div");
      element.className = name;
      return element;
    }
    _clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    _spreadFor(page) {
      return Math.max(
        0,
        this.pairs.findIndex((pair) =>
          pair.includes(
            this._clamp(Math.trunc(page) || 0, 0, this.pages.length - 1),
          ),
        ),
      );
    }
    get page() {
      return this.pairs[this.current].find((index) => index !== null);
    }
    get spread() {
      return this.current;
    }
    get pageCount() {
      return this.pages.length;
    }
    get spreadCount() {
      return this.pairs.length;
    }
    get isAnimating() {
      return !!(this.active || this.loading || this.drag);
    }
    get state() {
      return {
        page: this.page,
        spread: this.spread,
        pages: this.pairs[this.current].filter((p) => p !== null),
        pageCount: this.pageCount,
        spreadCount: this.spreadCount,
      };
    }
    next() {
      return this.goToSpread(this.desired + 1);
    }
    prev() {
      return this.goToSpread(this.desired - 1);
    }
    first() {
      return this.goToSpread(0);
    }
    last() {
      return this.goToSpread(this.pairs.length - 1);
    }
    goTo(page) {
      return this.goToSpread(this._spreadFor(page));
    }
    goToSpread(spread) {
      if (this.destroyed) return this;
      this.desired = this._clamp(
        Math.trunc(spread) || 0,
        0,
        this.pairs.length - 1,
      );
      if (this.drag) {
        this.drag.ended = true;
        this.drag.overridden = true;
        const id = this.drag.id;
        this.drag = null;
        try {
          this.book.releasePointerCapture(id);
        } catch {}
      }
      if (this.active) this._animate(this.desired === this.current ? 0 : 1);
      else this._pump();
      return this;
    }
    setOptions(options = {}) {
      // Layout dimensions are fixed at construction; motion and lighting are live-editable.
      for (const key of ["duration", "curl", "shadows"])
        if (key in options) this.options[key] = options[key];
      this.options.duration = Math.max(0, Number(this.options.duration) || 0);
      this.options.curl = this._clamp(
        Number(this.options.curl) || 1.72,
        0.2,
        2.5,
      );
      if (this.renderer) this.renderer.curl = this.options.curl;
      this.element.classList.toggle("pc-no-shadows", !this.options.shadows);
      if (this.active) this._draw(this.active.progress);
      return this;
    }
    async prepare(pageIndices, options = {}) {
      if (this.destroyed || !this.renderer) return false;
      const from = this.current;
      const indices =
        pageIndices === undefined
          ? [from + 1, from - 1]
              .filter((to) => to >= 0 && to < this.pairs.length)
              .flatMap((to) => this._turnPages(from, to))
          : Array.isArray(pageIndices)
            ? pageIndices
            : [pageIndices];
      const pages = [...new Set(indices)];
      if (
        pages.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= this.pages.length,
        )
      )
        throw new RangeError("PaperCurl: prepare expects valid page indices.");
      return (
        (await this._loadPages(pages, { ...options, source: "manual" })) !==
        false
      );
    }
    _progress(job, status, page = null, phase = "queued") {
      if (job.closed) return;
      const detail = {
        id: job.id,
        source: job.source,
        status,
        page,
        phase,
        pages: [...job.pages],
        completed: job.completed,
        total: job.pages.length,
        progress: job.pages.length ? job.completed / job.pages.length : 1,
      };
      if (status !== "preparing") {
        job.closed = true;
        this.preparations.delete(job);
      }
      // Progress observers must not interrupt shared capture work if they throw.
      for (const callback of [this.options.onProgress, job.onProgress]) {
        try {
          callback?.(detail);
        } catch (error) {
          setTimeout(() => {
            throw error;
          }, 0);
        }
      }
      this.element.dispatchEvent(
        new CustomEvent("prepareprogress", { detail }),
      );
    }
    _pageProgress(index, record, phase) {
      if (this.pageStatus.get(index) !== record || this.destroyed) return;
      record.phase = phase;
      for (const job of this.preparations)
        if (job.pages.includes(index))
          this._progress(job, "preparing", index, phase);
    }
    _cancelPreparations() {
      for (const job of [...this.preparations]) job.cancel();
    }
    async _loadPages(
      pages,
      { source, onProgress, valid = () => true, pause = 0 } = {},
    ) {
      const epoch = this.epoch;
      let cancel;
      const cancelled = new Promise((resolve) => {
        cancel = resolve;
      });
      const job = {
        id: ++this.preparationId,
        source,
        onProgress,
        pages,
        completed: 0,
        closed: false,
        cancel: () => {
          this._progress(job, "cancelled");
          cancel(false);
        },
      };
      this.preparations.add(job);
      this._progress(job, "preparing");
      const current = () =>
        !job.closed && !this.destroyed && epoch === this.epoch && valid();
      const captures = (async () => {
        const textures = [];
        try {
          for (let i = 0; i < pages.length; i += 2) {
            if (!current()) {
              job.cancel();
              return false;
            }
            const batch = await Promise.all(
              pages.slice(i, i + 2).map(async (index) => {
                this._progress(
                  job,
                  "preparing",
                  index,
                  this.pageStatus.get(index)?.phase || "queued",
                );
                const texture = await this._snapshot(index);
                if (current()) {
                  job.completed++;
                  this._progress(job, "preparing", index, "ready");
                }
                return texture;
              }),
            );
            textures.push(...batch);
            if (i + 2 < pages.length)
              await new Promise((resolve) => setTimeout(resolve, pause));
          }
          if (!current()) {
            job.cancel();
            return false;
          }
          this._progress(job, "ready", null, "ready");
          return !this.destroyed && epoch === this.epoch && valid()
            ? textures
            : false;
        } catch (error) {
          if (!current()) {
            job.cancel();
            return false;
          }
          this._progress(job, "error", null, "error");
          throw error;
        }
      })();
      return Promise.race([captures, cancelled]);
    }
    refresh(pageIndices) {
      // A targeted content edit keeps other textures and already downloaded assets.
      // Omit indices to explicitly reload every page, stylesheet, image and font.
      if (this.destroyed) return this;
      this.epoch++;
      this._cancelPreparations();
      this.loading = false;
      this.drag = null;
      if (this.active) this.current = this.active.from;
      this.desired = this.current;
      if (pageIndices === undefined) {
        this.cache.clear();
        this.pageStatus.clear();
        this.assets.clear();
        this.fontCache.clear();
        this.styleSheets.clear();
        this.fontRules = null;
      } else {
        for (const index of Array.isArray(pageIndices)
          ? pageIndices
          : [pageIndices]) {
          this.cache.delete(index);
          this.pageStatus.delete(index);
        }
      }
      this._rest();

      return this;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      clearTimeout(this.preloadTimer);
      this.epoch++;
      this._cancelPreparations();
      this._stopWorker();
      this.abort.abort();
      this.observer.disconnect();
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.dragRAF);
      this.renderer?.dispose();
      this.element.replaceChildren(...this.originalNodes);
      this.element.classList.remove("pc-host", "pc-dragging", "pc-no-shadows");
      this.element.removeAttribute("aria-busy");
      for (const [name, value] of [
        ["tabindex", this.originalTab],
        ["role", this.originalRole],
      ]) {
        if (value === null) this.element.removeAttribute(name);
        else this.element.setAttribute(name, value);
      }
      this.cache.clear();
      this.pageStatus.clear();
      this.assets.clear();
      this.fontCache.clear();
      this.styleSheets.clear();
      this.fontRules = null;
    }
    _size() {
      const bounds = this.element.getBoundingClientRect(),
        o = this.options,
        pad = Math.min(o.padding, Math.max(12, bounds.width * 0.045));
      const fit = Math.max(
        0.08,
        Math.min(
          (bounds.width - pad * 2) / (o.width * 2),
          (bounds.height - o.padding * 2) / o.height,
          o.maxScale,
        ),
      );
      this.width = Math.floor(o.width * fit);
      this.height = (this.width * o.height) / o.width;
      this.rig.style.width = this.width * 2 + "px";
      this.rig.style.height = this.height + "px";
      this.rig.style.setProperty("--pc-scale", this.width / o.width);
    }
    _offset(spread) {
      const pair = this.pairs[spread];
      return pair[0] === null
        ? -this.width / 2
        : pair[1] === null
          ? this.width / 2
          : 0;
    }
    _center() {
      this.center.style.transform = `translateX(${this._offset(this.current)}px)`;
    }
    _show(left, right) {
      this.wrappers.forEach((wrapper, i) => {
        wrapper.hidden = i !== left && i !== right;
        wrapper.inert = wrapper.hidden;
        wrapper.classList.toggle("pc-left", i === left);
        wrapper.classList.toggle("pc-right", i === right);
        wrapper.style.left = i === right ? "50%" : "0";
      });
    }
    _rest() {
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.dragRAF);
      this.raf = this.dragRAF = 0;
      this.active = null;
      this.renderer?.clear();
      this.book.classList.remove("pc-dragging");
      this.element.removeAttribute("aria-busy");
      this._size();
      this._show(...this.pairs[this.current]);
      this._center();
      this.shadows.forEach(
        (shadow, i) =>
          (shadow.style.opacity =
            this.pairs[this.current][i] === null ? "0" : "1"),
      );
      this.options.onChange?.(this.state);
      this.element.dispatchEvent(
        new CustomEvent("pagechange", { detail: this.state }),
      );
      this._schedulePreload();
    }
    _error(error) {
      this.options.onError?.(error);
      this.element.dispatchEvent(
        new CustomEvent("curlerror", { detail: error }),
      );
    }
    _stopWorker() {
      this.assetWorker?.terminate();
      this.assetWorker = null;
      for (const job of this.workerJobs.values())
        job.reject(new Error("PaperCurl: worker unavailable."));
      this.workerJobs.clear();
    }
    _worker() {
      if (!this.options.worker || this.workerFailed || this.destroyed)
        return null;
      if (this.assetWorker) return this.assetWorker;
      let url;
      try {
        // The worker stays inside the single distributable JS file. No bundler or
        // extra worker URL is required. CSP-blocked/unsupported workers fall back.
        const source = `self.onmessage = (event) => {
          const { id, type, value } = event.data;
          try {
            const result = type === "asset"
              ? new FileReaderSync().readAsDataURL(value)
              : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(value);
            self.postMessage({ id, result });
          } catch (error) { self.postMessage({ id, error: error.message }); }
        };`;
        url = URL.createObjectURL(
          new Blob([source], { type: "text/javascript" }),
        );
        const worker = new Worker(url);
        this.assetWorker = worker;
        worker.onmessage = ({ data }) => {
          const job = this.workerJobs.get(data.id);
          if (!job) return;
          this.workerJobs.delete(data.id);
          data.error
            ? job.reject(new Error(data.error))
            : job.resolve(data.result);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          this.workerFailed = true;
          this._stopWorker();
        };
        worker.onmessageerror = () => {
          this.workerFailed = true;
          this._stopWorker();
        };
        return worker;
      } catch {
        this.workerFailed = true;
        this._stopWorker();
        return null;
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    }
    async _encode(type, value) {
      if (this.destroyed)
        throw new Error("PaperCurl: destroyed during capture.");
      const worker = this._worker();
      if (worker) {
        try {
          return await new Promise((resolve, reject) => {
            const id = ++this.workerId;
            this.workerJobs.set(id, { resolve, reject });
            try {
              worker.postMessage({ id, type, value });
            } catch (error) {
              this.workerJobs.delete(id);
              reject(error);
            }
          });
        } catch {
          this.workerFailed = true;
          this._stopWorker();
        }
      }
      if (this.destroyed)
        throw new Error("PaperCurl: destroyed during capture.");
      if (type === "svg")
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(value);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(value);
      });
    }
    async _asset(url) {
      if (url.startsWith("data:")) return url;
      const absolute = new URL(url, document.baseURI).href;
      if (!this.assets.has(absolute)) {
        const job = (async () => {
          let response;
          try {
            response = await fetch(absolute);
          } catch {
            throw new Error(
              "PaperCurl: cannot capture " +
                absolute +
                ". The server must allow CORS, or use a same-origin/data URL.",
            );
          }
          if (!response.ok)
            throw new Error(
              "PaperCurl: asset could not be loaded: " + absolute,
            );
          const blob = await response.blob();
          const encoded = await this._encode("asset", blob);
          // CSS images (including border-image) must finish their first decode
          // before the isolated SVG paints, especially on a cold Firefox load.
          if (blob.type.startsWith("image/")) {
            const image = new Image();
            image.src = encoded;
            await image.decode();
          }
          return encoded;
        })();
        this.assets.set(absolute, job);
        job.catch(() => {
          if (this.assets.get(absolute) === job) this.assets.delete(absolute);
        });
      }
      return this.assets.get(absolute);
    }
    async _embedURLs(value, base = document.baseURI) {
      const urls = [
        ...value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g),
      ];
      const embedded = await Promise.all(
        urls.map(async (match) => {
          const url = (match[1] ?? match[2] ?? match[3]).trim();
          return url && !url.startsWith("#")
            ? `url("${await this._asset(new URL(url, base).href)}")`
            : match[0];
        }),
      );
      urls.forEach((match, i) => {
        value = value.replace(match[0], embedded[i]);
      });
      return value;
    }
    _fontKey(face) {
      const stretch = {
        "ultra-condensed": "50%",
        "extra-condensed": "62.5%",
        condensed: "75%",
        "semi-condensed": "87.5%",
        normal: "100%",
        "semi-expanded": "112.5%",
        expanded: "125%",
        "extra-expanded": "150%",
        "ultra-expanded": "200%",
      };
      return JSON.stringify([
        face.family
          .trim()
          .replace(/^["']|["']$/g, "")
          .toLowerCase(),
        (face.weight || "normal")
          .replace(/normal/g, "400")
          .replace(/bold/g, "700"),
        face.style || "normal",
        (face.stretch || "normal")
          .split(/\s+/)
          .map((s) => stretch[s] || s)
          .join(" "),
        (face.unicodeRange || "U+0-10FFFF").replace(/\s/g, "").toUpperCase(),
      ]);
    }
    async _pageFonts(nodes) {
      // Match actual text runs, not container families or the document-wide ready
      // promise. The browser handles variable ranges, nearest weights and synthesis.
      const runs = new Map(),
        hidden = new Set();
      for (const node of nodes) {
        if (
          ["STYLE", "SCRIPT", "IFRAME", "VIDEO", "AUDIO"].includes(node.tagName)
        )
          continue;
        let text = [...node.childNodes]
          .filter((child) => child.nodeType === 3)
          .map((child) => child.textContent)
          .join("");
        if (node.tagName === "INPUT" || node.tagName === "TEXTAREA")
          text += node.value || "";
        // Off-spread wrappers are hidden by the book. Ignore those ancestors,
        // but skip display:none subtrees inside the page itself.
        if (hidden.has(node.parentElement)) {
          hidden.add(node);
          continue;
        }
        const native = getComputedStyle(node);
        if (native.display === "none") {
          hidden.add(node);
          continue;
        }
        const textRuns = [[text, native]];
        for (const pseudo of ["::before", "::after"]) {
          const style = getComputedStyle(node, pseudo);
          if (
            style.display === "none" ||
            ["none", "normal", ""].includes(style.content)
          )
            continue;
          // Resolved attr() and CSS strings, including escaped font-icon glyphs.
          const generated = [
            ...style.content.matchAll(
              /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g,
            ),
          ]
            .map((match) =>
              (match[1] ?? match[2]).replace(
                /\\([0-9a-f]{1,6})\s?|\\([^\n])/gi,
                (_, hex, character) =>
                  hex
                    ? String.fromCodePoint(
                        Math.min(parseInt(hex, 16) || 0xfffd, 0x10ffff),
                      )
                    : character,
              ),
            )
            .join("");
          textRuns.push([generated, style]);
        }
        for (let [text, style] of textRuns) {
          if (!text.trim()) continue;
          // Include case expansions such as ß → SS when choosing Unicode subsets.
          const lang = node.closest("[lang]")?.lang;
          try {
            text +=
              text.toLocaleUpperCase(lang || undefined) +
              text.toLocaleLowerCase(lang || undefined);
          } catch {
            text += text.toUpperCase() + text.toLowerCase();
          }
          const stretch =
            {
              "50%": "ultra-condensed",
              "62.5%": "extra-condensed",
              "75%": "condensed",
              "87.5%": "semi-condensed",
              "100%": "normal",
              "112.5%": "semi-expanded",
              "125%": "expanded",
              "150%": "extra-expanded",
              "200%": "ultra-expanded",
            }[style.fontStretch] || style.fontStretch;
          const font =
            style.font ||
            `${style.fontStyle} ${style.fontWeight} ${stretch} ${style.fontSize} ${style.fontFamily}`;
          if (!runs.has(font))
            runs.set(font, { family: style.fontFamily, characters: new Set() });
          for (const character of text)
            runs.get(font).characters.add(character);
        }
      }
      const matches = await Promise.all(
        [...runs].map(async ([font, run]) => {
          const text = [...run.characters].join("");
          try {
            return await document.fonts.load(font, text);
          } catch (error) {
            if (error.name !== "SyntaxError") throw error;
            // Some computed values (e.g. fractional stretch) cannot be represented
            // by the FontFaceSet shorthand. Preserve fidelity with a family fallback.
            const normalize = (name) =>
              name
                .trim()
                .replace(/^["']|["']$/g, "")
                .toLowerCase();
            const families = run.family.split(",").map(normalize);
            return Promise.all(
              [...document.fonts]
                .filter(
                  (face) =>
                    families.includes(normalize(face.family)) &&
                    this._fontRangeUsed(face.unicodeRange, [...text]),
                )
                .map((face) => face.load()),
            );
          }
        }),
      );
      return [...new Set(matches.flat())];
    }
    async _fontCatalog() {
      if (this.fontRules) return this.fontRules;
      const job = (async () => {
        const faces = [],
          inaccessible = [],
          visited = new Set();
        const collect = (rules, base) => {
          for (const rule of rules) {
            if (rule.type === 5) {
              const get = (name) => rule.style.getPropertyValue(name);
              faces.push({
                css: rule.cssText,
                base,
                key: this._fontKey({
                  family: get("font-family"),
                  weight: get("font-weight"),
                  style: get("font-style"),
                  stretch: get("font-stretch"),
                  unicodeRange: get("unicode-range"),
                }),
              });
            } else if (rule.type === 3 && rule.styleSheet)
              visit(rule.styleSheet);
            else if (rule.cssRules) collect(rule.cssRules, base);
          }
        };
        const visit = (sheet) => {
          if (visited.has(sheet)) return;
          visited.add(sheet);
          try {
            collect(sheet.cssRules, sheet.href || document.baseURI);
          } catch {
            if (sheet.href) inaccessible.push(sheet.href);
          }
        };
        const parse = (css, base) => {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
          collect(sheet.cssRules, base);
        };
        [
          ...document.styleSheets,
          ...(document.adoptedStyleSheets || []),
        ].forEach(visit);
        if (this.options.fontCSS) parse(this.options.fontCSS, document.baseURI);
        // Parse each external sheet only once per cache lifetime. Keep import order
        // deterministic even when several pages request the same catalog together.
        const seenURLs = new Set();
        const load = async (url) => {
          if (seenURLs.has(url)) return;
          seenURLs.add(url);
          if (!this.styleSheets.has(url)) {
            const request = fetch(url).then((response) => {
              if (!response.ok)
                throw new Error("Font stylesheet could not be loaded: " + url);
              return response.text();
            });
            this.styleSheets.set(url, request);
            request.catch(() => {
              if (this.styleSheets.get(url) === request)
                this.styleSheets.delete(url);
            });
          }
          const css = await this.styleSheets.get(url);
          for (const match of css.matchAll(
            /@import\s+(?:url\(\s*)?["']([^"']+)["']/g,
          ))
            await load(new URL(match[1], url).href);
          parse(css.replace(/@import[^;]+;/g, ""), url);
        };
        let remoteJob;
        return {
          faces,
          loadRemote: () =>
            (remoteJob ||= (async () => {
              for (const url of inaccessible) {
                try {
                  await load(url);
                } catch {
                  /* Missing used faces are reported by _fontStyles. */
                }
              }
            })()),
        };
      })();
      this.fontRules = job;
      job.catch(() => {
        if (this.fontRules === job) this.fontRules = null;
      });
      return job;
    }
    async _fontStyles(usedFaces) {
      if (!usedFaces.length) return "";
      const used = new Map(
        usedFaces.map((face) => [this._fontKey(face), face.family]),
      );
      const catalog = await this._fontCatalog();
      if (
        [...used.keys()].some(
          (key) => !catalog.faces.some((face) => face.key === key),
        )
      )
        await catalog.loadRemote();
      const faces = catalog.faces.filter((face) => used.has(face.key));
      const missing = [...used].filter(
        ([key]) => !faces.some((face) => face.key === key),
      );
      if (missing.length) {
        // Permit retry after a failed stylesheet request; never silently use a fallback.
        this.fontRules = null;
        throw new Error(
          "PaperCurl: cannot embed font " +
            [...new Set(missing.map(([, name]) => name))].join(", ") +
            ". Supply its @font-face rules with the fontCSS option.",
        );
      }
      return (
        await Promise.all(
          faces.map((face) => {
            const key = face.base + "\n" + face.css;
            if (!this.fontCache.has(key)) {
              const css = face.css.includes("url(")
                ? face.css.replace(/local\([^)]*\)\s*,?\s*/g, "")
                : face.css;
              const job = this._embedURLs(css, face.base).then(
                async (embedded) => {
                  // Decode the embedded source once too. A loaded remote URL does not
                  // mean its data-URL copy is ready for an SVG's first paint in Chrome.
                  const sheet = new CSSStyleSheet();
                  sheet.replaceSync(embedded);
                  const rule = sheet.cssRules[0];
                  const get = (name) => rule.style.getPropertyValue(name);
                  const descriptors = {};
                  for (const [key, name] of [
                    ["weight", "font-weight"],
                    ["style", "font-style"],
                    ["stretch", "font-stretch"],
                    ["unicodeRange", "unicode-range"],
                  ])
                    if (get(name)) descriptors[key] = get(name);
                  await new FontFace(
                    get("font-family"),
                    get("src"),
                    descriptors,
                  ).load();
                  // Firefox can reject CSSOM descriptor writes. Append the
                  // override as text; the last font-display descriptor wins.
                  return `@font-face{${rule.style.cssText};font-display:block;}`;
                },
              );
              this.fontCache.set(key, job);
              job.catch(() => {
                if (this.fontCache.get(key) === job) this.fontCache.delete(key);
              });
            }
            return this.fontCache.get(key);
          }),
        )
      ).join("\n");
    }
    _fontRangeUsed(range, characters) {
      const intervals = [
        ...range.matchAll(/U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/gi),
      ].map((m) => [
        parseInt(m[1].replace(/\?/g, "0"), 16),
        parseInt(m[2] || m[1].replace(/\?/g, "F"), 16),
      ]);
      return (
        !intervals.length ||
        characters.some((character) =>
          intervals.some(
            ([start, end]) =>
              character.codePointAt(0) >= start &&
              character.codePointAt(0) <= end,
          ),
        )
      );
    }
    _withPageLayout(index, read) {
      const wrapper = this.wrappers[index];
      if (!wrapper.hidden) return read();
      const original = wrapper.style.cssText;
      // Container queries need layout even for sheets not currently displayed.
      // Reads are synchronous; restore before yielding or allowing a paint.
      wrapper.style.setProperty("display", "block", "important");
      try {
        return read();
      } finally {
        wrapper.style.cssText = original;
      }
    }
    _captureStyle(computed) {
      const doc = this.element.ownerDocument;
      let defaults = captureDefaults.get(doc);
      if (!defaults) {
        // An isolated all:initial probe gives the browser's own defaults. Store
        // only differences; otherwise hundreds of unused values bloat each node.
        const host = doc.createElement("div");
        host.style.cssText =
          "position:fixed;left:-10000px;top:0;visibility:hidden";
        const probe = doc.createElement("span");
        probe.style.setProperty("all", "initial", "important");
        host.attachShadow({ mode: "closed" }).append(probe);
        doc.documentElement.append(host);
        try {
          const style = getComputedStyle(probe);
          // The legacy WebKit border-image shorthand fills the center; use
          // the standard longhands so ordinary gradient frames stay hollow.
          defaults = new Map(
            [...style]
              .filter(
                (property) =>
                  !property.startsWith("--") &&
                  property !== "-webkit-border-image" &&
                  !/^(animation|transition)(-|$)/.test(property),
              )
              .map((property) => [property, style.getPropertyValue(property)]),
          );
          captureDefaults.set(doc, defaults);
        } finally {
          host.remove();
        }
      }
      // Keep the reset and overrides as ordered text. Incremental CSSOM edits
      // can expand all and discard unrelated longhands (columns, grid, masks).
      const declarations = ["all:initial!important"];
      let legacyMask = "";
      for (const [property, initial] of defaults) {
        const value = computed.getPropertyValue(property);
        // all does not reset direction or unicode-bidi. Preserve font-size
        // explicitly: initial (medium) can change size with a monospace family.
        if (
          value &&
          (value !== initial ||
            property === "font-size" ||
            property === "direction" ||
            property === "unicode-bidi")
        ) {
          // Chromium exposes legacy mask operators under the standard name,
          // although only the prefixed declaration accepts values such as xor.
          if (property === "mask-composite" && !CSS.supports(property, value))
            legacyMask = `-webkit-mask-composite:${value}!important`;
          else declarations.push(`${property}:${value}!important`);
        }
      }
      // Apply the legacy operator after standard mask layers have been parsed.
      if (legacyMask) declarations.push(legacyMask);
      return declarations.join(";") + ";";
    }
    async _snapshot(index) {
      if (this.cache.has(index)) return this.cache.get(index);
      const record = { phase: "queued" };
      this.pageStatus.set(index, record);
      const job = Promise.resolve().then(async () => {
        this._pageProgress(index, record, "assets");
        if (this.destroyed)
          throw new Error("PaperCurl: destroyed during capture.");
        const stage = this._node("pc-capture");
        stage.inert = true;
        stage.setAttribute("aria-hidden", "true");
        const clone = this.pages[index].cloneNode(true);
        // Keep temporary clones isolated from app selectors and live IDs.
        const surface = stage.attachShadow({ mode: "closed" });
        surface.append(clone);
        try {
          const originals = [
            this.pages[index],
            ...this.pages[index].querySelectorAll("*"),
          ];
          const cloned = [clone, ...clone.querySelectorAll("*")];
          // Select the already-displayed responsive image, before detaching picture
          // sources or srcset. Lazy images must be decoded before SVG rasterization.
          const images = Promise.all(
            cloned.map(async (node, i) => {
              const original = originals[i];
              if (node.tagName === "SOURCE") node.remove();
              if (node.tagName === "IMG") {
                node.removeAttribute("srcset");
                node.removeAttribute("sizes");
                node.removeAttribute("loading");
                node.removeAttribute("crossorigin");
                const source = original.currentSrc || original.src;
                if (source) {
                  const embedded = await this._asset(source);
                  // A cloned picture can cancel decode as its sources detach.
                  // Prime a standalone image, then give the clone that same URL.
                  const image = new Image();
                  image.src = embedded;
                  await image.decode();
                  node.src = embedded;
                }
              }
              if (
                node.namespaceURI === "http://www.w3.org/2000/svg" &&
                node.localName === "image"
              ) {
                const source =
                  original.getAttribute("href") ||
                  original.getAttributeNS(
                    "http://www.w3.org/1999/xlink",
                    "href",
                  );
                if (source) {
                  node.removeAttributeNS(
                    "http://www.w3.org/1999/xlink",
                    "href",
                  );
                  node.setAttribute("href", await this._asset(source));
                }
              }
              if (node.tagName === "INPUT")
                node.setAttribute("value", original.value);
              if (node.tagName === "TEXTAREA")
                node.textContent = original.value;
            }),
          );
          const [fonts] = await Promise.all([
            this._withPageLayout(index, () => this._pageFonts(originals)).then(
              (faces) => this._fontStyles(faces),
            ),
            images,
          ]);
          if (this.destroyed)
            throw new Error("PaperCurl: destroyed during capture.");
          this._pageProgress(index, record, "layout");
          // Read every source style before mutating clones. This preserves the
          // original ancestors, inherited values, scoped CSS, and structural rules.
          const styles = this._withPageLayout(index, () =>
            originals.map((node) => ({
              css: this._captureStyle(getComputedStyle(node)),
              pseudo: ["::before", "::after"].flatMap((pseudo) => {
                const computed = getComputedStyle(node, pseudo);
                return computed.display !== "none" &&
                  !["none", "normal", ""].includes(computed.content)
                  ? [[pseudo, this._captureStyle(computed)]]
                  : [];
              }),
            })),
          );
          this.rig.append(stage);
          const paperColor = getComputedStyle(stage).backgroundColor;
          const rules = [];
          for (let n = 0; n < cloned.length; n++) {
            const node = cloned[n];
            node.setAttribute("style", await this._embedURLs(styles[n].css));
            if (styles[n].pseudo.length) {
              node.setAttribute("data-pc-pseudo", String(n));
              for (const [pseudo, css] of styles[n].pseudo)
                rules.push(
                  `[data-pc-pseudo="${n}"]${pseudo}{${await this._embedURLs(css)}}`,
                );
            }
            if (
              ["STYLE", "LINK", "SCRIPT", "IFRAME", "VIDEO", "AUDIO"].includes(
                node.tagName,
              )
            )
              node.remove();
          }
          const style = document.createElement("style");
          style.textContent = fonts + rules.join("\n");
          surface.prepend(style);
          // Keep real pseudo-elements for their layout/paint order; no extra
          // spans that could change flex/grid children or structural selectors.
          stage.remove();
          stage.append(...surface.childNodes);
          stage.style.cssText = `display:block;position:relative;width:${this.options.width}px;height:${this.options.height}px;overflow:hidden;background-color:${paperColor}`;
          const markup = new XMLSerializer().serializeToString(stage),
            w = this.options.width,
            h = this.options.height;
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
          // Data URLs keep this rasterization origin-clean and allow the bundled demo to open offline.
          const image = new Image();
          this._pageProgress(index, record, "encoding");
          image.src = await this._encode("svg", svg);
          this._pageProgress(index, record, "rasterizing");
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * this.options.textureScale);
          canvas.height = Math.round(h * this.options.textureScale);
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          context.getImageData(0, 0, 1, 1);
          record.phase = "ready";
          return canvas;
        } finally {
          stage.remove();
        }
      });
      this.cache.set(index, job);
      job.catch(() => {
        if (this.cache.get(index) === job) {
          this.cache.delete(index);
          this.pageStatus.delete(index);
        }
      });
      return job;
    }
    _turnPages(from, to) {
      return to > from
        ? [this.pairs[from][1], this.pairs[to][0]]
        : [this.pairs[to][1], this.pairs[from][0]];
    }
    _schedulePreload() {
      clearTimeout(this.preloadTimer);
      if (
        !this.options.preload ||
        !this.renderer ||
        this.reduced.matches ||
        this.destroyed
      )
        return;
      // Coalesce reactive edits and give the browser time to paint the live page.
      this.preloadTimer = setTimeout(() => {
        this.preloadTimer = 0;
        this._preload();
      }, 40);
    }
    async _preload() {
      const from = this.current;
      const pages = [from + 1, from - 1]
        .filter((to) => to >= 0 && to < this.pairs.length)
        .flatMap((to) => this._turnPages(from, to));
      try {
        await this._loadPages(pages, {
          source: "preload",
          pause: 16,
          valid: () => from === this.current && !this.isAnimating,
        });
      } catch {
        /* On-demand navigation reports capture failures through onError. */
      }
    }
    async _prepare(to, corner = 1) {
      if (this.active || this.loading || this.destroyed) return false;
      const epoch = this.epoch,
        from = this.current,
        direction = Math.sign(to - from);
      this.loading = true;
      this.element.setAttribute("aria-busy", "true");
      try {
        const [front, back] = this._turnPages(from, to);
        const textures = await this._loadPages([front, back], {
          source: "turn",
        });
        if (!textures || this.destroyed || epoch !== this.epoch) return false;
        this.active = { from, to, direction, corner, progress: 0 };
        this.renderer.setPages(...textures, this.width, this.height);
        this._show(
          direction > 0 ? this.pairs[from][0] : this.pairs[to][0],
          direction > 0 ? this.pairs[to][1] : this.pairs[from][1],
        );
        this.shadows.forEach((shadow, i) => {
          if (this.pairs[to][i] === null) shadow.style.opacity = "0";
        });
        this._draw(0);
        return true;
      } catch (error) {
        if (!this.destroyed && epoch === this.epoch) {
          this._error(error);
          this.current = this.desired;
          this._rest();
        }
        return false;
      } finally {
        if (epoch === this.epoch) {
          this.loading = false;
          this.element.removeAttribute("aria-busy");
        }
      }
    }
    _draw(progress) {
      if (!this.active) return;
      const a = this.active;
      a.progress = progress;
      this.renderer.draw(
        a.direction > 0 ? progress : 1 - progress,
        a.corner,
        this.options.shadows,
      );
      const t =
          progress *
          progress *
          progress *
          (progress * (6 * progress - 15) + 10),
        from = this._offset(a.from),
        to = this._offset(a.to);
      this.center.style.transform = `translateX(${from + (to - from) * t}px)`;
    }
    _finish(commit) {
      if (!this.active) return;
      if (commit) this.current = this.active.to;
      else this.desired = this.current;
      this._rest();
      if (this.desired !== this.current) queueMicrotask(() => this._pump());
    }
    _animate(end) {
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.dragRAF);
      if (!this.active) return;
      if (this.reduced.matches || this.options.duration === 0) {
        this._draw(end);
        this._finish(end === 1);
        return;
      }
      const start = this.active.progress,
        duration = this.options.duration * Math.max(0.2, Math.abs(end - start));
      let before = performance.now(),
        elapsed = 0;
      const tick = (now) => {
        if (!this.active || this.destroyed) return;
        elapsed +=
          (now - before) *
          (Math.abs(this.desired - this.active.to) > 1 ? 1.25 : 1);
        before = now;
        const t = this._clamp(elapsed / duration, 0, 1),
          eased = t * t * t * (t * (6 * t - 15) + 10);
        this._draw(start + (end - start) * eased);
        if (t < 1) this.raf = requestAnimationFrame(tick);
        else this._finish(end === 1);
      };
      this.raf = requestAnimationFrame(tick);
    }
    async _pump() {
      if (
        this.active ||
        this.loading ||
        this.drag ||
        this.destroyed ||
        this.current === this.desired
      )
        return;
      if (this.reduced.matches || !this.renderer) {
        this.current = this.desired;
        this._rest();
        return;
      }
      if (
        await this._prepare(
          this.current + Math.sign(this.desired - this.current),
        )
      )
        this._animate(this.desired === this.current ? 0 : 1);
    }
    _bind() {
      const on = (node, event, handler) =>
        node.addEventListener(event, handler, { signal: this.abort.signal });
      on(this.book, "pointerdown", async (event) => {
        if (
          event.button !== 0 ||
          this.active ||
          this.loading ||
          event.target.closest(
            "a,button,input,select,textarea,[contenteditable]",
          )
        )
          return;
        const bounds = this.book.getBoundingClientRect(),
          x = event.clientX - bounds.left,
          y = event.clientY - bounds.top,
          edge = Math.max(30, this.width * 0.17),
          direction = x > this.width * 2 - edge ? 1 : x < edge ? -1 : 0;
        if (
          !direction ||
          y < 0 ||
          y > this.height ||
          this.current + direction < 0 ||
          this.current + direction >= this.pairs.length
        )
          return;
        this.desired = this.current;
        const drag = {
          id: event.pointerId,
          direction,
          start: event.clientX,
          last: event.clientX,
          time: performance.now(),
          velocity: 0,
          target: 0,
          moved: false,
          ended: false,
        };
        this.drag = drag;
        this.book.setPointerCapture(event.pointerId);
        this.book.classList.add("pc-dragging");
        event.preventDefault();
        if (this.reduced.matches || !this.renderer) return;
        if (
          await this._prepare(
            this.current + direction,
            y > this.height / 2 ? 1 : -1,
          )
        ) {
          if (drag.ended) this._settle(drag);
          else this._dragLoop();
        } else this.drag = null;
      });
      on(this.book, "pointermove", (event) => {
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const d = this.drag,
          now = performance.now(),
          travel = (d.start - event.clientX) * d.direction;
        d.velocity =
          ((d.last - event.clientX) * d.direction) / Math.max(1, now - d.time);
        d.last = event.clientX;
        d.time = now;
        d.moved = d.moved || Math.abs(travel) > 6;
        d.target = this._clamp(travel / (this.width * 1.8), 0, 1);
      });
      const release = (event, cancelled = false) => {
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const d = this.drag;
        d.ended = true;
        d.cancelled = cancelled;
        this.drag = null;
        this.book.classList.remove("pc-dragging");
        try {
          this.book.releasePointerCapture(d.id);
        } catch {}
        if (!this.loading) this._settle(d);
      };
      on(this.book, "pointerup", (event) => release(event));
      on(this.book, "pointercancel", (event) => release(event, true));
      on(this.book, "lostpointercapture", (event) => release(event, true));
      if (this.options.keyboard)
        on(this.element, "keydown", (event) => {
          if (
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.target.closest("input,select,textarea,[contenteditable]")
          )
            return;
          const actions = {
            ArrowRight: () => this.next(),
            ArrowLeft: () => this.prev(),
            Home: () => this.first(),
            End: () => this.last(),
          };
          if (actions[event.key]) {
            event.preventDefault();
            actions[event.key]();
          }
        });
      on(this.reduced, "change", () => {
        if (this.reduced.matches && this.active) this._finish(true);
      });
    }
    _dragLoop() {
      if (!this.drag || !this.active) return;
      const target = this.drag.target,
        next = this.active.progress + (target - this.active.progress) * 0.38;
      this._draw(Math.abs(target - next) < 0.0003 ? target : next);
      this.dragRAF = requestAnimationFrame(() => this._dragLoop());
    }
    _settle(drag) {
      cancelAnimationFrame(this.dragRAF);
      if (drag.overridden) {
        if (this.active) this._animate(this.desired === this.current ? 0 : 1);
        return;
      }
      const commit =
        !drag.cancelled &&
        (!drag.moved ||
          drag.target > 0.42 ||
          (performance.now() - drag.time < 140 && drag.velocity > 0.45));
      this.desired = commit ? this.current + drag.direction : this.current;
      if (this.active) this._animate(commit ? 1 : 0);
      else {
        this.current = this.desired;
        this._rest();
      }
    }
  }
  global.PaperCurl = PaperCurl;
  if (typeof module !== "undefined" && module.exports)
    module.exports = PaperCurl;
})(typeof window !== "undefined" ? window : globalThis);
