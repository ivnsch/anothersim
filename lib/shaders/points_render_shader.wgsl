@group(0) @binding(0) var<storage, read> points: array<vec4<f32>, 300>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
}

@vertex
fn vert_main(
    @builtin(vertex_index) VertexIndex: u32,
    @builtin(instance_index) InstanceIndex: u32
) -> VertexOutput {
    // render a big triangle
    // const size = 1;
    // var positions = array<vec2<f32>, 3>(
    //     vec2<f32>(0.0, size),
    //     vec2<f32>(size, -size),
    //     vec2<f32>(-size, -size),
    // );

    const size = 0.02;
    const sh = size / 2.; // size half
    let point = points[InstanceIndex];

    var positions = array<vec2<f32>, 3>(
        vec2<f32>(point.x, -point.y + sh), // top
        vec2<f32>(point.x - sh, -point.y - sh), // bottom left
        vec2<f32>(point.x + sh, -point.y - sh), // bottom right
    );

    var output: VertexOutput;
    output.Position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
    return output;
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
    return vec4<f32>(1, 1, 0, 1);
}
