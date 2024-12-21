@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(2) var<uniform> camera: mat4x4<f32>;
@group(0) @binding(3) var<uniform> sample_points: array<vec4<f32>, 300>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let screen_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));
    let screen_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

    let coords = to_world_coords(screen_size, screen_pos);

    var pixel_color: vec4<f32> = vec4<f32>(1.0, 0.0, 0.0, 1.0);

    // if coords.x > 0 {
    //     pixel_color = vec4<f32>(0.0, 0.0, 1.0, 1.0);
    // }

    let point_4 = vec4<f32>(coords.x, coords.y, 0, 0);
    let density = calc_density(point_4, sample_points);

    textureStore(color_buffer, screen_pos, color_for_density(density));
    // textureStore(color_buffer, screen_pos, pixel_color);
}

fn to_world_coords(screen_size: vec2<i32>, screen_pos: vec2<i32>) -> vec2<f32> {
    let offset_x = f32(screen_pos.x) - f32(screen_size.x) / 2.;
    let offset_y = f32(screen_pos.y) - f32(screen_size.y) / 2.;
    let normalized_x: f32 = (offset_x / f32(screen_size.x)) * 2;
    let normalized_y: f32 = (offset_y / f32(screen_size.y)) * 2;

    return vec2<f32>(normalized_x, normalized_y);
}

fn calc_density(position: vec4<f32>, sample_points: array<vec4<f32>, 300>) -> f32 {
    let radius = 0.1;
    let mass = 4.;

    var total_density: f32 = 0.0;

    for (var i: i32 = 0; i < 300; i += 1) {
        let sample_point = sample_points[i];
        let distance = distance(position, sample_point);
        let influence = smoothing_kernel(radius, distance);
        total_density += mass * influence;
    }
    return total_density;
}

fn smoothing_kernel(radius: f32, distance: f32) -> f32 {
    let pi = 3.14159;
    let volume = (pi * pow(radius, 8.0)) / 4.0;
    let value = max(0, radius * radius - distance * distance);
    return pow(value, 3) / volume;
}

fn color_for_density(density: f32) -> vec4<f32> {
    // TODO why do we have to scale density down? it should be [0..1]
    let scaled_density = density * 0.001;
    return vec4<f32>(scaled_density, 0, 1 - scaled_density, 1);
}
