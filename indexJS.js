var initialize = async() =>{
    var unityCanvas = document.querySelector("#unity-canvas");
    var videoCanvas = document.querySelector("#video-canvas");
    window.arCamera = new ARCamera(unityCanvas, videoCanvas);
    window.iTracker = new ImageTracker(arCamera);
    try{
        await window.iTracker.initialize();
        console.log("ImageTracker initialized!");
    }
    catch{
        console.error("Failed to initialize ImageTracker. Are you missing opencv.js? " + error);
        ShowError("Failed to initialize the experience.");
        return;
    }
    
    await LoadWebcams();
    var select = document.getElementById("chooseCamSel");
    if (select && select.options.length > 0) {
        select.selectedIndex = 0;
        SelectCam();
    }
    // Attempt to start automatically without requiring button click
    StartAR();
}

initialize();

var container = document.querySelector("#unity-container");
var canvas = document.querySelector("#unity-canvas");
var loadingBar = document.querySelector("#unity-loading-bar");
var progressBarFull = document.querySelector("#unity-progress-bar-full");
window.hasStartedAR = false;
function StartAR() {
    if (window.hasStartedAR) return;
    window.hasStartedAR = true;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    
    document.getElementById("startARDiv").style.display = "none";
    // Request camera access immediately within the user gesture to avoid browser blocking (iOS/Safari)
    RequestWebcam();
    createUnityInstance(document.querySelector("#unity-canvas"), {
        dataUrl: "Build/Build.data",
        frameworkUrl: "Build/Build.framework.js",
        codeUrl: "Build/Build.wasm",
        streamingAssetsUrl: "StreamingAssets",
        companyName: "DefaultCompany",
        productName: "WeddingCard",
        productVersion: "0.1",
        //webglContextAttributes: { "preserveDrawingBuffer": true },
        // matchWebGLToCanvasSize: false, // Uncomment this to separately control WebGL canvas render size and DOM element size.
        // devicePixelRatio: 1, // Uncomment this to override low DPI rendering on high DPI displays.
        },
        (progress) => {
            progressBarFull.style.width = 100 * progress + "%";
        }
    ).then((unityInstance) => {
        window.unityInstance = unityInstance;
        loadingBar.style.display = "none";
        //document.body.style.backgroundImage = 'none';
        // Reveal canvas after engine init to hide engine splash, with 1s delay
        setTimeout(() => {
            document.getElementById('unity-canvas').style.opacity = '1';
            document.getElementById('unity-loading-bar').style.opacity = '0';
        }, 3000);
    });
    loadingBar.style.display = "block";
}
//Set Facing Mode here ('environment', 'user', '')
window.unityFacingMode = "environment"

window.WEBCAM_SETTINGS = {
    video: {
        facingMode: unityFacingMode,
    },
    audio: false
};

window.requestingForPermissions = false;
async function RequestWebcam(){
    window.requestingForPermissions = true;
    try{
        window.webcamStream = await navigator.mediaDevices.getUserMedia(window.WEBCAM_SETTINGS);
        console.log("Webcam access granted");
        window.requestingForPermissions = false;
    }
    catch (err) {
        //user denied camera permission - show error panel
        console.error("getUserMedia error - " , err);
        ShowError("Failed to start the experience. Camera permission was denied");
        window.requestingForPermissions = false;
    }           
}

async function StartWebcam(){
    console.log("StartWebcam")

    while (window.requestingForPermissions) {
        // Wait until requestingForPermissions becomes true.
        console.log("Waiting for permissions...");
        await new Promise(resolve => setTimeout(resolve, 300)); // Adjust the delay time as needed.
    }

    console.log("Got Permissions");

    if(window.webcamStream)
    {
        const video = document.querySelector("#webcam-video");
        video.srcObject = webcamStream;
        try {
            await arCamera.startWebcam(video);
            console.log("Webcam started successfully");

            window.unityInstance.SendMessage('ARCamera', 'OnStartWebcamSuccess');
        }
        catch(err){
            console.error("Webcam failed to start - ", err);
            window.unityInstance.SendMessage('ARCamera', 'OnStartWebcamFail');
        }   
    }
    else{
        console.error("Webcam failed to start - permission not yet granted");
        window.unityInstance.SendMessage('ARCamera', 'OnStartWebcamFail');
    }  
}
async function LoadWebcams(){
    let camDevices = [];
    // let backCams = [];
    let devices = await navigator.mediaDevices.enumerateDevices();
    var ctr = 0;
    devices.forEach(mediaDevice => {
        if (mediaDevice.kind === 'videoinput') {

            if(window.unityFacingMode == 'environment' && !mediaDevice.label.includes('facing front')){
                //back cam only
                camDevices.push(mediaDevice);
            }
            else if(window.unityFacingMode == 'user' && mediaDevice.label.includes('facing front')){
                //front cam only
                camDevices.push(mediaDevice);
            }
            else{
                //back and front
                camDevices.push(mediaDevice);
            }   
            
            ctr++;
        }
    });
    var select = document.getElementById("chooseCamSel");
    // keep selector hidden
    var count = 0;
    //reverse array because some Android phones can't distinguish front and back cams at first load
    //and when this happens, most of the time, front cam goes first and back cam goes last
    camDevices = camDevices.reverse();
    camDevices.forEach(mediaDevice => {
        const option = document.createElement('option');
        option.value = mediaDevice.deviceId;
        let label = `Camera ${count}`;
        if (mediaDevice.label) {
            label = mediaDevice.label
        }
        const textNode = document.createTextNode(label);
        option.appendChild(textNode);
        select.appendChild(option);
        count++;
    });
    // default to first camera if available
    if (select.options.length > 0) {
        select.selectedIndex = 0;
        iTracker.WEBCAM_NAME = select.options[select.selectedIndex].innerHTML;
    }
}
function SelectCam(){
    var select = document.getElementById("chooseCamSel");
    window.deviceId = select.value;
    // Use deviceId exact; remove facingMode to avoid overconstrained errors
    delete window.WEBCAM_SETTINGS.video.facingMode;
    window.WEBCAM_SETTINGS.video['deviceId'] = { exact: deviceId };
    //console.log(window.WEBCAM_SETTINGS);
    iTracker.WEBCAM_NAME = select.options[select.selectedIndex].innerHTML;
}

async function FlipCam(){
    arCamera.stopWebcam();
    window.WEBCAM_SETTINGS.video.deviceId = '';

    if(window.WEBCAM_SETTINGS.video.facingMode == 'user'){
        window.WEBCAM_SETTINGS.video.facingMode = 'environment';
        arCamera.setFlipped(false);
    }
    else{
        window.WEBCAM_SETTINGS.video.facingMode = 'user';
        arCamera.setFlipped(true);
    }
    window.webcamStream = await navigator.mediaDevices.getUserMedia(window.WEBCAM_SETTINGS);

    const video = document.querySelector("#webcam-video");
    video.srcObject = webcamStream;

    await arCamera.startWebcam(video);
}

function ShowError(error){
    document.getElementById("errorDiv").style.display = "flex";
    document.getElementById("errorText").innerHTML = error;
}

function ShowScreenshot(dataUrl){
    document.getElementById("screenshotDiv").style.display = "flex";
    document.getElementById("screenshotImg").src = dataUrl;
    document.getElementById("screenshotImg").style.width = "80vw";
    document.getElementById("screenshotImg").style.height = 80 / window.innerWidth * window.innerHeight + "vw";
}

function ShowConfirmUrl(url){
    document.getElementById("confirmUrlDiv").style.display = "flex";
    window.newUrlString = url;
    document.getElementById("confirmUrlText").innerText = "Are you sure you want to visit " + url;                
}

window.ITRACKER_GLOBALS = {
    //place global settings here
    INTERNAL_SMOOTHFACTOR_POS: .075,
}


