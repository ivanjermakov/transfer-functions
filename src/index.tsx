/* @refresh reload */
import { Component, For, createEffect, createSignal, onMount, untrack } from 'solid-js'
import { render } from 'solid-js/web'
import { Color, Vector2 } from 'three'
import * as exrLoader from 'three/examples/jsm/loaders/EXRLoader'
import fragmentGlsl from './fragment.glsl?raw'
import './index.css'
import vertexGlsl from './vertex.glsl?raw'

let canvas!: HTMLCanvasElement
let gl!: WebGL2RenderingContext
let program!: WebGLProgram

const modes = ['sweep', 'grayscale', 'image']
type Mode = (typeof modes)[number]
const aspectRatio = 16 / 9
const transferFns = ['none', 'reinhard', 'hable-filmic', 'aces']
type TransferFn = (typeof transferFns)[number]
const images = ['primaries-sweep', 'highlight-desaturation', 'cornell-box', 'additive-light']
type Image = (typeof images)[number]
const texture: Record<Image, WebGLTexture | undefined> = Object.fromEntries(images.map(i => [i, undefined]))

export const Main: Component = () => {
    const [loaded, setLoaded] = createSignal(false)
    const [mode, setMode] = createSignal<Mode>('image')
    const [image, setImage] = createSignal<Image>('cornell-box')
    const [transferFn, setTransferFn] = createSignal<TransferFn>('none')
    const [exposure, setExposure] = createSignal(1)
    const [ev, setEv] = createSignal(0)
    const [gamma, setGamma] = createSignal(2.2)

    onMount(async () => {
        gl = canvas.getContext('webgl2', {
            antialiasing: false,
            preserveDrawingBuffer: true
        })! as WebGL2RenderingContext
        canvas.height = 900
        canvas.width = canvas.height * aspectRatio
        const dpr = window.devicePixelRatio
        canvas.style.width = `${canvas.width / dpr}px`
        canvas.style.height = `${canvas.height / dpr}px`

        await Promise.all(
            Object.keys(texture).map(async name => {
                const res = await fetch(`${name}.exr`)
                const array = await res.arrayBuffer()
                const exr = new exrLoader.EXRLoader().parse(array)
                const tex = gl.createTexture()
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, exr.width, exr.height, 0, gl.RGBA, gl.HALF_FLOAT, exr.data)
                texture[name as any] = tex
            })
        )

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexGlsl)
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentGlsl)

        program = gl.createProgram()
        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)
        gl.useProgram(program)

        const positionAttributeLocation = gl.getAttribLocation(program, 'position')
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
        const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(positionAttributeLocation)
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)

        setLoaded(true)

        update()

        canvas.addEventListener('mousemove', event => {
            const dpr = window.devicePixelRatio
            const pos = new Vector2(event.offsetX * dpr, event.offsetY * dpr).floor()
            const color = getPixelColor(pos)
            const e = exposure()
            const components = [color.r, color.g, color.b]
            console.info(
                components.map(c => (c / 255).toFixed(2)).join(', '),
                `(${components.map(c => (c / 255 / e).toFixed(2)).join(', ')})`
            )
        })
    })

    createEffect(() => {
        const loaded_ = loaded()
        const image_ = image()
        const mode_ = mode()
        const exposure_ = exposure()
        const transferFn_ = transferFn()
        const gamma_ = gamma()
        if (!loaded_) return

        gl.bindTexture(gl.TEXTURE_2D, texture[image_]!)
        const modeLocation = gl.getUniformLocation(program, 'mode')
        gl.uniform1ui(modeLocation, modes.indexOf(mode_))
        const exposureLocation = gl.getUniformLocation(program, 'exposure')
        gl.uniform1f(exposureLocation, exposure_)
        const transferFnLocation = gl.getUniformLocation(program, 'transferFn')
        gl.uniform1ui(transferFnLocation, transferFns.indexOf(transferFn_))
        const gammaLocation = gl.getUniformLocation(program, 'gamma')
        gl.uniform1f(gammaLocation, gamma_)

        update()
    })

    createEffect(() => {
        const exposure_ = exposure()
        untrack(() => setEv(Math.log2(exposure_)))
    })

    createEffect(() => {
        const ev_ = ev()
        untrack(() => setExposure(2 ** ev_))
    })

    const update = () => {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.finish()
    }

    const createShader = (type: number, source: string) => {
        const shader = gl.createShader(type)!
        gl.shaderSource(shader, source)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader)!
            gl.deleteShader(shader)
            throw Error(error)
        }

        return shader
    }

    const getPixelColor = (screenPos: Vector2): Color => {
        update()
        const pixels = new Uint8Array(4)
        gl.readPixels(screenPos.x, canvas.height - screenPos.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        return new Color().fromArray(pixels)
    }

    return (
        <>
            <canvas ref={canvas} />
            <div class="controls">
                <h2>Controls</h2>
                <section>
                    <label>Mode</label>
                    <For each={modes}>
                        {m => (
                            <button type="button" onClick={() => setMode(m)} classList={{ active: m === mode() }}>
                                {m}
                            </button>
                        )}
                    </For>
                </section>
                <section>
                    <label>Image</label>
                    <For each={images}>
                        {img => (
                            <button
                                type="button"
                                onClick={() => setImage(img)}
                                classList={{ active: mode() === 'image' && img === image() }}
                                disabled={mode() !== 'image'}
                            >
                                {img}
                            </button>
                        )}
                    </For>
                </section>
                <section>
                    <label>Transfer function</label>
                    <For each={transferFns}>
                        {fn => (
                            <button
                                type="button"
                                onClick={() => setTransferFn(fn)}
                                classList={{ active: fn === transferFn() }}
                            >
                                {fn}
                            </button>
                        )}
                    </For>
                </section>
                <section>
                    <label>Render</label>
                    <label>
                        <span>EV</span>
                        <input type="number" step={1} value={ev()} onChange={e => setEv(e.target.valueAsNumber)} />
                    </label>
                    <label>
                        <span>Exposure</span>
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={exposure()}
                            onChange={e => setExposure(e.target.valueAsNumber)}
                        />
                    </label>
                    <label>
                        <span>Gamma</span>
                        <div>
                            <input
                                type="checkbox"
                                checked={gamma() !== 1}
                                onChange={e => setGamma(e.target.checked ? 2.2 : 1)}
                            />
                            <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={gamma()}
                                onChange={e => setGamma(e.target.valueAsNumber)}
                            />
                        </div>
                    </label>
                </section>
            </div>
        </>
    )
}

render(() => <Main />, document.getElementById('root')!)
