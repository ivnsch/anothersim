@group(0) @binding(0) var<uniform> points: array<vec4<f32>, 100>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) TexCoord: vec2<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(0.5, 0.5),
        vec2<f32>(0.5, -0.5),
        vec2<f32>(-0.5, -0.5),
    );

    var texCoords = array<vec2<f32>, 3>(
        vec2<f32>(0.5, 0.0),
        vec2<f32>(0.5, 0.5),
        vec2<f32>(0.0, 0.5),
    );

    var output: VertexOutput;
    output.Position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
    output.TexCoord = texCoords[VertexIndex];
    return output;
}

@fragment
fn frag_main(@location(0) TexCoord: vec2<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(1, 0, 0, 1);
}
