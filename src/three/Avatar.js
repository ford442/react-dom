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
        const gltf = await Gltf2.fetch('https://glsl.1ink.us/gltf/nabba.gltf');
        const arm = this.armature_from_gltf(gltf);
        this.arm = arm;
        const mat = SkinMTXMaterial('cyan', arm.getSkinOffsets()[0]);
        const mesh = UtilGltf2.loadMesh(gltf, null, mat);
        this.app.add(mesh);
        this.startAnimationLoop();
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
            const elapsedTime = this.clock.getElapsedTime() * 1000;
            if (this.arm && this.animationState.action === 'wave') {
                const waveBone = this.arm.bones[this.arm.names.get('UpperArm_R')];
                const animProgress = (elapsedTime - this.animationState.startTime) / this.animationState.duration;
                if (waveBone && animProgress < 1) {
                    const waveAngle = (Math.PI / 2) * Math.sin(animProgress * Math.PI);
                    const tempQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), waveAngle);
                    waveBone.local.rot.copy(tempQuat);
                } else if (waveBone) {
                    this.animationState.action = 'idle';
                    waveBone.local.rot.set(0, 0, 0, 1);
                }
            }
            this.app.render();
        };
        animate();
    }

    wave() {
        this.animationState.action = 'wave';
        this.animationState.startTime = this.clock.getElapsedTime() * 1000;
    }
}

export default Avatar;
