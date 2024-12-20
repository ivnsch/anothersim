@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let screen_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));
    let screen_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

    var pixel_color: vec4<f32> = vec4<f32>(1.0, 0.0, 0.0, 1.0);

    textureStore(color_buffer, screen_pos, pixel_color);
}
