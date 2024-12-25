@group(0) @binding(0) var<storage, read_write> sample_points: array<vec4<f32>, 300>;
@group(0) @binding(1) var<uniform> time: f32;

@compute @workgroup_size(64)
fn update(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x; // 1d workgroup - use x for indexing

    // simulate semi random motion using time as seed and bunch of calculations
    // (no random available in shader)
    // chatgpt generated, it looks sufficiently similar to the previous typescript / Math.random() motion
    let random_offset = vec2<f32>(
        fract(sin(f32(index) * 12.9898 + time) * 43758.5453),
        fract(sin(f32(index + 1u) * 78.233 + time) * 43758.5453)
    );

    sample_points[index] = vec4<f32>(
        sample_points[index].xy + (random_offset * 0.01),
        sample_points[index].z,
        sample_points[index].w
    );
}