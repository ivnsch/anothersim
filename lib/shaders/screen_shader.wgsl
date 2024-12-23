struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4<f32>,
    @location(1) @interpolate(flat) instance_idx: u32
};

@binding(0) @group(0) var<uniform> projection: mat4x4<f32>;
@binding(1) @group(0) var<uniform> camera: mat4x4<f32>;
@binding(2) @group(0) var<uniform> meshType: u32;
@binding(3) @group(0) var<uniform> x_axes_transforms: array<mat4x4f, 20>;
@binding(4) @group(0) var<uniform> z_axes_transforms: array<mat4x4f, 20>;
@binding(5) @group(0) var<uniform> cube_transforms: array<mat4x4f, 100>;
@binding(6) @group(0) var<uniform> cube_color_map: array<vec4<f32>, 100>;
@binding(7) @group(0) var<uniform> cube_density_transforms: array<mat4x4f, 1000>;
@binding(8) @group(0) var<uniform> cube_density_color_map: array<vec4<f32>, 1000>;
@binding(9) @group(0) var<uniform> file_obj_transform: mat4x4<f32>;

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex: u32,     
    @location(0) vertex: vec3<f32>,
    @builtin(instance_index) instance_idx : u32,
) -> OurVertexShaderOutput {
    let vertex_4 = vec4<f32>(vertex, 1.0);

    var transformed = vertex_4;

    var output: OurVertexShaderOutput;

    if (meshType == 0) { // x axis
        // position instance
        transformed = x_axes_transforms[instance_idx] * vertex_4;
        output.color = vec4<f32>(0.0, 0.0, 1.0, 0.0); // blue
        // don't transform axis
    } else if (meshType == 1) { // y axis
        transformed = vertex_4;
        output.color = vec4<f32>(0.0, 1.0, 0.0, 0.0); // green
    } else if (meshType == 2) { // z axis
        transformed = z_axes_transforms[instance_idx] * vertex_4;
        output.color = vec4<f32>(0.5, 0.5, 1.0, 0.0); // light blue
    } else if (meshType == 3) { // cube instances
        transformed = cube_transforms[instance_idx] * vertex_4;
        output.color = cube_color_map[instance_idx];
    } else if (meshType == 4) { // cube density instances
        transformed = cube_density_transforms[instance_idx] * vertex_4;
        output.color = cube_density_color_map[instance_idx];
    } else if (meshType == 5) {
        transformed = file_obj_transform * vertex_4;
        output.color = vec4<f32>(0.5, 1.0, 0.5, 0.0); // light green 
    } else { // unexpected
        output.color = vec4<f32>(0.0, 0.0, 0.0, 0.0); // black
    }

    transformed = projection * camera * transformed;

    output.position = transformed;
    output.instance_idx = instance_idx;

    return output;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
    return color;
}
