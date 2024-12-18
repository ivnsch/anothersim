struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3<f32>
};

@binding(0) @group(0) var<uniform> projection: mat4x4<f32>;
@binding(1) @group(0) var<uniform> camera: mat4x4<f32>;
@binding(2) @group(0) var<uniform> meshType: u32;
@binding(3) @group(0) var<uniform> x_axes_transforms: array<mat4x4f, 20>;
@binding(4) @group(0) var<uniform> z_axes_transforms_new: array<mat4x4f, 20>;
@binding(5) @group(0) var<uniform> identity: mat4x4f; // for debugging sometimes..
@binding(6) @group(0) var<uniform> cube_transforms: array<mat4x4f, 100>;

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
        output.color = vec3<f32>(0.0, 0.0, 1.0); // blue
        // don't transform axis
    } else if (meshType == 1) { // y axis
        transformed = vertex_4;
        output.color = vec3<f32>(0.0, 1.0, 0.0); // green
    } else if (meshType == 2) { // z axis new
        transformed = z_axes_transforms_new[instance_idx] * vertex_4;
        output.color = vec3<f32>(0.5, 0.5, 1.0); // light blue
    } else if (meshType == 3) { // cube instances
        transformed = cube_transforms[instance_idx] * vertex_4;
        output.color = vec3<f32>(0.5, 0.5, 1.0); // light blue
    }else { // unexpected
        output.color = vec3<f32>(0.0, 0.0, 0.0); // black
    }

    transformed = projection * camera * transformed;

    output.position = transformed;
    return output;
}

@fragment
fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
}
