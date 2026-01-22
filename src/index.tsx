/* @refresh reload */
import { Component, For, createEffect, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import * as exrLoader from 'three/examples/jsm/loaders/EXRLoader'
import fragmentGlsl from './fragment.glsl?raw'
import './index.css'
import vertexGlsl from './vertex.glsl?raw'

let canvas!: HTMLCanvasElement
let gl!: WebGL2RenderingContext
let program!: WebGLProgram

type Mode = 'sweep' | 'image'
const aspectRatio = 16 / 9
const transferFns = ['none', 'reinhard', 'hable-filmic', 'aces']
type TransferFn = (typeof transferFns)[number]
const images = ['primaries-sweep', 'highlight-desaturation', 'cornell-box']
type Image = (typeof images)[number]
const texture: Record<Image, WebGLTexture | undefined> = {
    'primaries-sweep': undefined,
    'highlight-desaturation': undefined,
    'cornell-box': undefined
}

export const Main: Component = () => {
    const [loaded, setLoaded] = createSignal(false)
    const [mode, setMode] = createSignal<Mode>('image')
    const [image, setImage] = createSignal<Image>('primaries-sweep')
    const [transferFn, setTransferFn] = createSignal<TransferFn>('none')
    const [exposure, setExposure] = createSignal(1)

    onMount(async () => {
        gl = canvas.getContext('webgl2', { antialiasing: false })! as WebGL2RenderingContext
        canvas.height = 720
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
    })

    createEffect(() => {
        const loaded_ = loaded()
        const activeImage_ = image()
        const activeMode_ = mode()
        const exposure_ = exposure()
        const transferFn_ = transferFn()
        if (!loaded_) return

        gl.bindTexture(gl.TEXTURE_2D, texture[activeImage_]!)
        const modeLocation = gl.getUniformLocation(program, 'mode')
        gl.uniform1ui(modeLocation, activeMode_ === 'sweep' ? 0 : 1)
        const exposureLocation = gl.getUniformLocation(program, 'exposure')
        gl.uniform1f(exposureLocation, exposure_)
        const transferFnLocation = gl.getUniformLocation(program, 'transferFn')
        gl.uniform1ui(transferFnLocation, transferFns.indexOf(transferFn_))

        update()
    })

    const update = () => {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.drawArrays(gl.TRIANGLES, 0, 6)
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

    return (
        <>
            <canvas ref={canvas} />
            <div class="controls">
                <h2>Controls</h2>
                <section>
                    <label>Mode</label>
                    <For each={['sweep', 'image']}>
                        {m => (
                            <button
                                type="button"
                                onClick={() => setMode(m as Mode)}
                                classList={{ active: m === mode() }}
                            >
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
                        Exposure
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={exposure()}
                            onChange={e => setExposure(e.target.valueAsNumber)}
                        />
                    </label>
                </section>
            </div>
        </>
    )
}

render(() => <Main />, document.getElementById('root')!)
