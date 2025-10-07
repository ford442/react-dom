import * as THREE from 'three';
import { Gltf2, Armature, SkinMTX } from "../lib/ossos/ossos.ts";
import SkinMTXMaterial from '../../../ossos/examples/threejs/_lib/SkinMTXMaterial.js';
import { UtilGltf2 } from '../../../ossos/examples/threejs/_lib/UtilGltf2.js';
import Starter from '../../../ossos/examples/threejs/_lib/Starter.js';

class Avatar {
    constructor(container) {
        this.app = new Starter({ container, webgl2: true });
        this.arm = null;
        this.clock = new THREE.Clock();
        this.animationState = { action: 'idle', startTime: 0, duration: 1000 };
    }

    // FIX: Modified the load function to be async and throw errors
    async load() {
        try {
            console.log("Avatar: Starting to load GLTF model...");
            const gltf = await Gltf2.fetch('https://glsl.1ink.us/gltf/nabba.gltf');
            const arm = this.armature_from_gltf(gltf);
            this.arm = arm;

            const mat = SkinMTXMaterial('cyan', arm.getSkinOffsets()[0]);
            const mesh = UtilGltf2.loadMesh(gltf, null, mat);
            
            this.app.add(mesh);
            console.log("Avatar: Model added to the scene successfully.");
            
            this.startAnimationLoop();
        } catch (error) {
            console.error("Avatar Load Error:", error);
            // Re-throw the error so the App component can catch it
            throw new Error(`Failed to load avatar: ${error.message}`);
        }
    }

    armature_from_gltf(gltf, defaultBoneLen = 0.07) {
      const arm = new Armature();
      for (let j of gltf.getSkin().joints) {
          arm.addBone(j.name, j.parentIndex, j.rotation, j.position, j.scale);
      }
      arm.bind(SkinMTX, defaultBoneLen);
      return arm;
    }

    startAnimationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            // ... (animation logic remains the same)
            this.app.render();
        };
        animate();
    }
    
    // ... (other methods like wave)
}

export default Avatar;
