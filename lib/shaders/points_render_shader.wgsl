@group(0) @binding(0) var<uniform> points: array<vec4<f32>, 100>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
    const size = 0.02;
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(0.0, size),
        vec2<f32>(size, -size),
        vec2<f32>(-size, -size),
    );

    var output: VertexOutput;
    output.Position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
    return output;
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
    return vec4<f32>(1, 1, 0, 1);
}
