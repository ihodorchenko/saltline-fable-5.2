// Saltline enemy system: gull/hound pools, AI, projectiles and wrecks.
// Three.js classes and Saltline tuning/helpers arrive through the game context
// so the module has no dependency on the minified game scope.

import { createRng } from '../../engine/core/rng.js';

/**
 * @param {object} i game context
 * @param {object} deps Saltline enemy tuning and helper functions
 * @returns {Promise<object>} enemies module
 */
export async function createEnemySystem(i, deps) {
  const {
    MeshBasicMaterial: Nn,
    DoubleSide: Sn,
    InstancedMesh: Sr,
    Color: Ve,
    CylinderGeometry: Ys,
    DynamicDrawUsage: bo,
    AdditiveBlending: hr,
    Group: wt,
    ShaderMaterial: zn,
    Vector3: W,
  } = i.THREE;
  const { BC, HC, Q_, Qv, Ui, Z_, iM, j_, sa, OC, aM, cM, lM, oM, rM, uM } = deps;
let e=createRng(+(i.params&&i.params.eseed||9001)),t=[],n=[],s=new wt;s.name="enemies",i.scene.add(s);let o=i.mats.emissive(16777215,1),r=o&&o.isMeshBasicMaterial?o.clone():new Nn;r.color.setRGB(1,1,1),r.vertexColors=!0,r.needsUpdate=!0;let a=i.mats.emissive(16752704,6),l=a&&a.isMeshBasicMaterial?a:new Nn({color:16752704}),c=o&&o.toneMapped!==void 0?o.toneMapped:!0,u={shell:i.mats.get("armor_white",{triplanar:!0,vertexColors:!0}),metal:i.mats.get("gunmetal",{triplanar:!0,vertexColors:!0}),glow:r,lensBase:l,disc:new Nn({color:789775,transparent:!0,opacity:.42,depthWrite:!1,side:Sn,toneMapped:c}),cone:new zn({uniforms:{uColor:{value:new Ve(1,.9,.74)},uGain:{value:.085}},vertexShader:`
        #include <common>
        #include <skinning_pars_vertex>
        varying float vT; varying vec3 vN; varying vec3 vV;
        void main() {
          #include <beginnormal_vertex>
          #include <skinbase_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vN = normalMatrix * objectNormal; vV = -mv.xyz; vT = 1.0 - uv.y;
          gl_Position = projectionMatrix * mv;
        }`,fragmentShader:`
        uniform vec3 uColor; uniform float uGain;
        varying float vT; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = abs(dot(normalize(vN), normalize(vV)));
          f = f * f * (3.0 - 2.0 * f);
          float t = clamp(vT, 0.0, 1.0);
          float k = pow(1.0 - t, 1.7) * (0.35 + 0.65 * smoothstep(0.0, 0.06, t));
          gl_FragColor = vec4(uColor * (uGain * f * k), 1.0);
        }`,transparent:!0,blending:hr,depthWrite:!1,side:Sn,fog:!1})},h={G:i,rng:e,list:t,t:0,playerSpeed:0,tokens:0,tokenT:-9,lastType:"",wantT:{gull:-9,hound:-9},mergeSimple:T=>sa(T,!1),requestToken(T){if(T.hasToken)return!0;let D=0;for(let Q of t)Q.alive&&D++;let C=D>5?Ui.maxTokensCrowd:Ui.maxTokens,G=h.t-h.tokenT,j=T.type==="gull"?"hound":"gull",N=h.lastType===T.type&&h.t-h.wantT[j]<.5&&G<Ui.tokenGap*2.2;return h.tokens>=C||G<Ui.tokenGap||N?(h.wantT[T.type]=h.t,!1):(h.tokens++,h.tokenT=h.t,h.lastType=T.type,T.hasToken=!0,!0)},releaseToken(T){T.hasToken&&(T.hasToken=!1,h.tokens=Math.max(0,h.tokens-1))},think(T,D,C){let G=i.player;if(T.passive||!G){T.los=!1;return}if(T.senseT-=D,T.senseT<=0){T.senseT=.11+e()*.08;let j=!1;if(G.alive!==!1){let N=G.eye||G.pos,Q=N.x-T.sensor.x,K=N.y-T.sensor.y,ie=N.z-T.sensor.z,F=Math.hypot(Q,K,ie);if(F<Ui.sightRange){let X=Math.hypot(Q,ie)||1e-4,ne=(Q*T.fwd.x+ie*T.fwd.z)/X;(T.mode==="engage"||ne>BC||F<3.5)&&(j=i.physics.lineOfSight(T.sensor,N))}}T.los=j}T.los?(T.seeT+=D,T.noSeeT=0,T.lastKnown.copy(G.pos),T.exposure=Math.min(1,T.exposure+D*Ui.exposureUp)):(T.noSeeT+=D,T.seeT=Math.max(0,T.seeT-D*.6),T.exposure=Math.max(0,T.exposure-D*Ui.exposureDown)),T.mode==="engage"?(T.noSeeT>Ui.loseSight||G.alive===!1)&&(T.mode="search",T.modeT=Ui.searchTime+e()*3,h.releaseToken(T)):T.los&&T.seeT>(T.mode==="patrol"?C:C*.45)?(T.mode="engage",T.noSeeT=0,i.events.emit("enemy:alert",{enemy:T}),h.rally(T.pos,18,G.pos,T)):T.mode!=="patrol"&&(T.modeT-=D,T.modeT<=0&&(T.mode="patrol",T.home.x=T.pos.x,T.home.z=T.pos.z))},rally(T,D,C,G){for(let j of t)j===G||!j.alive||j.passive||j.mode==="engage"||j.pos.distanceToSquared(T)>D*D||(j.lastKnown.copy(C),j.mode="investigate",j.modeT=9+e()*4)},provoke(T){let D=i.player;!D||T.passive||!T.alive||(T.mode!=="engage"&&(T.lastKnown.copy(D.pos),T.mode="investigate",T.modeT=10,T.seeT=1,T.senseT=0),h.rally(T.pos,20,D.pos,T))},fireBolt(T,D,C){let G=null;for(let j=0;j<g.length;j++)if(!g[j].on){G=g[j];break}G&&(G.on=!0,G.life=1.3,G.pos.copy(T),G.dir.copy(D),G.from.copy(T),G.len=0)},addWreck(T){for(n.push(T);n.length>Ui.maxWrecks;){let D=n.shift();D.active&&(D.sink=.001)}},retire(T){T._deactivate();let D=t.indexOf(T);D>=0&&t.splice(D,1),D=n.indexOf(T),D>=0&&n.splice(D,1)}},f=j_(),p=Z_(),d=[],v=[];for(let T=0;T<Ui.poolGulls;T++){let D=Q_(h,f,u,T);d.push(D),s.add(D.rig.group)}for(let T=0;T<Ui.poolHounds;T++){let D=iM(h,p,u,T);v.push(D),s.add(D.rig.group)}let g=[];for(let T=0;T<Ui.maxBolts;T++)g.push({on:!1,life:0,len:0,pos:new W,dir:new W,from:new W});let x=new Ys(.016,.03,1,6,1);x.rotateX(Math.PI/2),x.translate(0,0,-.5);let y=i.mats.emissive(16738858,14),b=y&&y.isMeshBasicMaterial?y:new Nn({color:new Ve(16738858).multiplyScalar(14)}),m=new Sr(x,b,Ui.maxBolts);m.frustumCulled=!1,m.castShadow=!1,m.receiveShadow=!1,m.count=0,m.instanceMatrix.setUsage(bo),s.add(m);let A={point:new W,normal:new W,dist:0,surface:"concrete",enemy:null,part:null,dir:new W,from:"enemy"};function _(T){let D=i.player,C=0;for(let G=0;G<g.length;G++){let j=g[G];if(!j.on)continue;let N=Ui.gull.boltSpeed*T;j.life-=T;let Q=i.physics.raycast(j.pos,j.dir,N),K=Q?Q.dist:N,ie=!1;if(D&&D.alive!==!1&&(oM.copy(j.pos).addScaledVector(j.dir,K),cM.set(D.pos.x,D.pos.y+.35,D.pos.z),uM.set(D.pos.x,D.pos.y+(D.crouching?1:1.5),D.pos.z),HC(j.pos,oM,cM,uM)<.36*.36&&(ie=!0)),ie){D.damage(Ui.gull.boltDamage,j.from),j.on=!1;continue}if(Q){A.point.copy(Q.point),A.normal.copy(Q.normal),A.dist=Q.dist,A.surface=Q.surface,A.dir.copy(j.dir),i.events.emit("impact",A),j.on=!1;continue}if(j.life<=0){j.on=!1;continue}j.pos.addScaledVector(j.dir,N),j.len=Math.min(1.5,j.len+N),rM.setFromUnitVectors(OC,j.dir),lM.set(1,1,Math.max(.2,j.len)),aM.compose(j.pos,rM,lM),m.setMatrixAt(C++,aM)}(C||m.count)&&(m.count=C,m.instanceMatrix.needsUpdate=!0)}let M=null,E=!1,w=0,S=new W,z=0;function H(T){if(!E){E=!0;try{M=i.render&&i.render.lightPool&&i.render.lightPool.acquire?i.render.lightPool.acquire():null}catch{M=null}M&&M.light&&(M.light.color.setRGB(1,.9,.75),M.light.distance=9)}if(!M||!M.light)return;let D=null,C=3600,G=i.camera?i.camera.position:null;for(let N of t){if(N.type!=="gull"||!N.alive)continue;let Q=G?N.pos.distanceToSquared(G):0;Q<C&&(C=Q,D=N)}let j=0;if(D){if(w-=T,w<=0){w=.1;let N=D.yaw+D.gy,Q=Math.cos(D.gp);Qv.set(Math.sin(N)*Q,-Math.sin(D.gp),Math.cos(N)*Q).normalize();let K=i.physics.raycast(D.sensor,Qv,14);S.copy(D.sensor).addScaledVector(Qv,(K?K.dist:8)-.6),z=K?1:.3}j=26*z,M.light.position.lerp(S,1-Math.exp(-12*T))}M.light.intensity+=(j-M.light.intensity)*(1-Math.exp(-8*T))}let O=1,q=0,U={list:t,TUNE:Ui,spawn(T,D,C={}){let G=T==="gull"?d:T==="hound"?v:null;if(!G)return null;let j=null;for(let N of G)if(!N.active){j=N;break}if(!j&&T==="hound"&&n.length){let N=n[0];h.retire(N),j=N}return j?(j.id=O++,t.push(j),j._activate(D,C),i.events.emit("enemy:spawn",{enemy:j}),j):null},raycast(T,D,C=300){let G=null;for(let j=0;j<t.length;j++){let N=t[j];if(!N.alive)continue;let Q=N.pos.x-T.x,K=N.pos.y+(N.type==="hound"?.6:0)-T.y,ie=N.pos.z-T.z,F=Q*D.x+K*D.y+ie*D.z;F<-1.5||F>C+1.5||Q*Q+K*K+ie*ie-F*F>1.7||(G||(G={dist:1/0,point:new W,normal:new W,enemy:null,part:"body"}),N._raycast(T,D,C,G))}return G&&G.enemy?G:null},aliveCount(){let T=0;for(let D of t)D.alive&&T++;return T},clear(){for(let T of d)T.active&&T._deactivate();for(let T of v)T.active&&T._deactivate();t.length=0,n.length=0,h.tokens=0;for(let T of g)T.on=!1;m.count=0,M&&M.light&&(M.light.intensity=0)},alert(T,D=40){for(let C of t)!C.alive||C.passive||C.mode==="engage"||C.pos.distanceToSquared(T)>D*D||(C.lastKnown.copy(T),C.lastKnown.y=Math.max(0,T.y-1.6),C.mode==="patrol"&&i.events.emit("enemy:alert",{enemy:C,noise:!0}),C.mode="investigate",C.modeT=9+e()*4)},update(T){if(T<=0)return;T>.05&&(T=.05),h.t+=T,q-=T;let D=i.player;if(D){let C=D.vel?Math.hypot(D.vel.x,D.vel.z):D.speed||0;h.playerSpeed+=(C-h.playerSpeed)*(1-Math.exp(-6*T))}for(let C=t.length-1;C>=0;C--)t[C]._update(T);_(T),H(T)},debug:{ctx:h,gulls:d,hounds:v,wrecks:n,bolts:g,mats:u,tris:{gull:f.tris+f.extra.tris,hound:p.tris}}};return i.events.on("weapon:fire",T=>{if(q>0)return;q=.3;let D=T&&(T.origin||T.muzzle)||i.player&&i.player.pos;D&&U.alert(D,Ui.hearRadius)}),i.events.on("explosion",T=>{T&&T.pos&&U.alert(T.pos,30)}),i.events.on("game:state",T=>{T&&T.state==="title"&&U.clear()}),U
}
