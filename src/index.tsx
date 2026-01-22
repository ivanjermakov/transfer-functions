/* @refresh reload */
import { Component, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import fragmentGlsl from './fragment.glsl?raw'
import './index.css'
import vertexGlsl from './vertex.glsl?raw'

let canvas!: HTMLCanvasElement
let gl!: WebGL2RenderingContext

export const Main: Component = () => {
    onMount(() => {
        gl = canvas.getContext('webgl2', { antialiasing: false })! as WebGL2RenderingContext
        canvas.width = 1280
        canvas.height = 720
        const dpr = window.devicePixelRatio
        canvas.style.width = `${canvas.width / dpr}px`
        canvas.style.height = `${canvas.height / dpr}px`

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexGlsl)
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentGlsl)

        const program = gl.createProgram()
        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)

        const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

        const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(program)
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
