@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(2) var<uniform> camera: mat4x4<f32>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let screen_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));
    let screen_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

    let offset_x = f32(screen_pos.x) - f32(screen_size.x) / 2.;
    let offset_y = f32(screen_pos.y) - f32(screen_size.y) / 2.;
    let normalized_x: f32 = offset_x / f32(screen_size.x);
    let normalized_y: f32 = offset_y / f32(screen_size.x);

    var pixel_color: vec4<f32> = vec4<f32>(1.0, 0.0, 0.0, 1.0);

    if normalized_x > 0 {
        pixel_color = vec4<f32>(0.0, 0.0, 1.0, 1.0);
    }

    textureStore(color_buffer, screen_pos, pixel_color);
}
