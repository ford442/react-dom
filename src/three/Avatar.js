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
            throw new Error(`Failed to load avatar: ${error.message}`);
        }
    }

    /**
     * NEW METHOD: Sets the avatar's current animation.
     * @param {string} actionName - The name of the animation to play (e.g., 'wave', 'nod').
     * @param {number} duration - How long the animation should play in milliseconds.
     */
    setAnimation(actionName, duration = 3000) {
        console.log(`Setting avatar animation to: ${actionName}`);
        // This is where you would add your logic to find and play the actual animation clip
        // from your GLTF model's armature. For now, we'll just update the state.
        this.animationState.action = actionName;
        this.animationState.startTime = this.clock.getElapsedTime();
        this.animationState.duration = duration;

        // After the animation duration, revert to 'idle'.
        // This is a simple approach; a more advanced state machine could be used here.
        setTimeout(() => {
            // Only revert to idle if another animation hasn't already been set.
            if (this.animationState.action === actionName) {
                this.animationState.action = 'idle';
                console.log('Reverting avatar animation to: idle');
            }
        }, duration);
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
            // In a full implementation, you'd check `this.animationState.action` here
            // and apply the corresponding animation pose to the armature on each frame.
            this.app.render();
        };
        animate();
    }
}

export default Avatar;
