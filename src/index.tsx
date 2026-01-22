/* @refresh reload */
import { Component, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import * as exrLoader from 'three/examples/jsm/loaders/EXRLoader'
import fragmentGlsl from './fragment.glsl?raw'
import './index.css'
import vertexGlsl from './vertex.glsl?raw'

let canvas!: HTMLCanvasElement
let gl!: WebGL2RenderingContext

export const Main: Component = () => {
    onMount(async () => {
        gl = canvas.getContext('webgl2', { antialiasing: false })! as WebGL2RenderingContext
        canvas.width = 1280
        canvas.height = 720
        const dpr = window.devicePixelRatio
        canvas.style.width = `${canvas.width / dpr}px`
        canvas.style.height = `${canvas.height / dpr}px`

        // const res = await fetch('primaries-sweep.exr')
        // const res = await fetch('highlight-desaturation.exr')
        const res = await fetch('cornell-box.exr')
        const array = await res.arrayBuffer()
        const exr = new exrLoader.EXRLoader().parse(array)
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, exr.width, exr.height, 0, gl.RGBA, gl.HALF_FLOAT, exr.data)

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexGlsl)
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentGlsl)

        const program = gl.createProgram()
        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)
        gl.useProgram(program)

        const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

        const uniformLocation = gl.getUniformLocation(program, 'u_texture')
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform1i(uniformLocation, 0)

        const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.enableVertexAttribArray(positionAttributeLocation)
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)

        gl.drawArrays(gl.TRIANGLES, 0, 6)
    })

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
        </>
    )
}

render(() => <Main />, document.getElementById('root')!)
