# Texture attribution

Surface texture maps used by Constellation.

## Solar System Scope — CC BY 4.0

Source: <https://www.solarsystemscope.com/textures/>
License: Creative Commons Attribution 4.0 International (CC BY 4.0)
<https://creativecommons.org/licenses/by/4.0/>

The following files are 2k equirectangular maps from Solar System Scope:

| File          | Body    | Notes                              |
| ------------- | ------- | ---------------------------------- |
| `sol.jpg`     | Sun     | catalog body name is `sol`         |
| `mercury.jpg` | Mercury |                                    |
| `venus.jpg`   | Venus   | atmosphere map                     |
| `earth.jpg`   | Earth   | daymap                             |
| `luna.jpg`    | Luna    | (Solar System Scope "moon")        |
| `mars.jpg`    | Mars    |                                    |
| `jupiter.jpg` | Jupiter |                                    |
| `saturn.jpg`  | Saturn  |                                    |
| `uranus.jpg`  | Uranus  |                                    |
| `neptune.jpg` | Neptune |                                    |

## Not textured

The Galilean moons (Io, Europa, Ganymede, Callisto), Titan, Triton, Pluto,
and Charon are not available from Solar System Scope and are rendered as
plain colored spheres (color from `backend/data/bodies.json`). Drop a
`<name>.jpg` equirectangular map into this directory to texture any of them —
the renderer picks it up automatically via the catalog's `texture` field.
