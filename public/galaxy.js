(() => {
 const canvas=document.querySelector('#galaxy-stars'),context=canvas?.getContext('2d');
 if(!context)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let stars=[],frame=0,last=0,width=0,height=0;
 function resize(){
  width=innerWidth;height=innerHeight;const ratio=Math.min(devicePixelRatio||1,1.5);
  canvas.width=width*ratio;canvas.height=height*ratio;context.setTransform(ratio,0,0,ratio,0,0);
  stars=Array.from({length:Math.min(150,Math.floor(width*height/11000))},(_,i)=>({x:((i*127.31)%997)/997*width,y:((i*73.17)%991)/991*height,r:.4+(i%4)*.22}));
 }
 function draw(time){
  if(time-last>50){last=time;context.clearRect(0,0,width,height);for(const [i,s]of stars.entries()){
   context.fillStyle=`rgba(205,222,255,${.3+Math.sin(time/4200+i)*.2})`;
   context.beginPath();context.arc((s.x+time*.0008)%width,s.y,s.r,0,Math.PI*2);context.fill();
  }}
  frame=requestAnimationFrame(draw);
 }
 function start(){cancelAnimationFrame(frame);if(!reduced.matches&&!document.hidden)frame=requestAnimationFrame(draw);}
 resize();start();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',start);reduced.addEventListener('change',start);
})();
