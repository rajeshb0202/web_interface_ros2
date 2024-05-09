var app = new Vue({
    el: '#app',
    // storing the state of the page
    data: {
        connected: false,
        ros: null,
        logs: [],
        loading: false,
        rosbridge_address: '',
        port: '9090',
        mapViewer: null,
        mapGridClient: null,
        interval: null,
        dragging: false,
        x: 'no',
        y: 'no',
        dragCircleStyle: {
            margin: '0px',
            top: '0px',
            left: '0px',
            display: 'none',
            width: '75px',
            height: '75px',
        },
        // joystick valules
        joystick: {
            vertical: 0,
            horizontal: 0,
        },
        // 3D stuff
        viewer: null,
        tfClient: null,
        urdfClient: null,

        // waypoints
        waypoints: {
        1: {x:0.2, y:-0.5, z: 0},
        2: {x:0.65 , y:-0.5, z: 0},
        3: {x:0.65, y:0.45, z: 0},
        4: {x:0.2, y:0.45, z: 0},
        5: {x:0.2, y:0.03, z: 0},
        6: {x:-0.12, y:0.0, z: 0}, 
        7: {x:-0.15, y:0.45, z: 0},
        8: {x:-0.65, y:0.45, z: 0},
        9: {x:-0.1, y:-0.45, z: 0},
        10: {x:-0.65, y:-0.54, z: 0},
        },
        goal: null,
        action: {
            feedback: { position: 0, state: 'idle' },
            result: { success: false },
            status: { status: 0, text: '' },
        }
    },

    // helper methods to connect to ROS
    methods: {
        connect: function() {
            this.loading = true
            this.ros = new ROSLIB.Ros({
                url: this.rosbridge_address
            })
            this.ros.on('connection', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Connected!')
                this.connected = true
                this.loading = false
                // setting the camera
                this.setCamera()
                this.setMapViewer()
                // this.setup3DViewer()
            })


            this.ros.on('error', (error) => {
                this.logs.unshift((new Date()).toTimeString() + ` - Error: ${error}`)
            })


            this.ros.on('close', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Disconnected!')
                this.connected = false
                this.loading = false
                document.getElementById('divCamera').innerHTML = ''
                document.getElementById('map').innerHTML = ''
                // this.unset3DViewer()
            })
        },
        disconnect: function() {
            this.ros.close()
            this.logs=[]
        },

     
        // method for rendering camera images
        setCamera: function() {
            let without_wss = this.rosbridge_address.split('wss://')[1]
            console.log(without_wss)
            let domain = without_wss.split('/')[0] + '/' + without_wss.split('/')[1]
            console.log(domain)
            let host = domain + '/cameras'
            let viewer = new MJPEGCANVAS.Viewer({
                divID: 'divCamera',
                host: host,
                width: 320,
                height: 240,
                topic: '/camera/image_raw',
                ssl: true,
            })
            this.logs.unshift('camera is ready...')
        },

        // method for rendering generated map
        setMapViewer: function() {
            this.mapViewer = new ROS2D.Viewer({
                divID: 'map',
                width: 480,
                height: 360
            })

            // Setup the map client.
            this.mapGridClient = new ROS2D.OccupancyGridClient({
                ros: this.ros,
                rootObject: this.mapViewer.scene,
                continuous: true,
            })

            this.mapGridClient.on('change', ()=> {
                let scaleFactor=4;
                this.mapViewer.scaleToDimensions(this.mapGridClient.currentGrid.width/scaleFactor, this.mapGridClient.currentGrid.height/scaleFactor);
                this.mapViewer.shift(this.mapGridClient.currentGrid.pose.position.x/scaleFactor, this.mapGridClient.currentGrid.pose.position.y/scaleFactor);
            })
            this.logs.unshift('Displaying the generated map...')
        },


        //section for handling joystick
        sendCommand: function(linear_x, angular_z) {
            let topic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/cmd_vel',
                messageType: 'geometry_msgs/Twist'
            })
            let message = new ROSLIB.Message({
                linear: { x: linear_x, y: 0, z: 0, },
                angular: { x: 0, y: 0, z: (-1)*angular_z, },
            })
            topic.publish(message)
        },
        startDrag() {
            this.dragging = true
            this.x = this.y = 0
        },
        stopDrag() {
            this.dragging = false
            this.x = this.y = 'no'
            this.dragCircleStyle.display = 'none'
            this.resetJoystickVals()
        },
        doDrag(event) {
            if (this.dragging) {
                this.x = event.offsetX
                this.y = event.offsetY
                let ref = document.getElementById('dragstartzone')
                this.dragCircleStyle.display = 'inline-block'

                let minTop = ref.offsetTop - parseInt(this.dragCircleStyle.height) / 2
                let maxTop = minTop + 200
                let top = this.y + minTop
                this.dragCircleStyle.top = `${top}px`

                let minLeft = ref.offsetLeft - parseInt(this.dragCircleStyle.width) / 2
                let maxLeft = minLeft + 200
                let left = this.x + minLeft
                this.dragCircleStyle.left = `${left}px`

                this.setJoystickVals()
            }
        },
        setJoystickVals() {
            this.joystick.vertical = -1 * ((this.y / 200) - 0.5)
            this.joystick.horizontal = +2 * ((this.x / 200) - 0.5)
            this.sendCommand(this.joystick.vertical, this.joystick.horizontal)
        },
        // doDrag(event) {
        //     if (this.dragging) {
        //         let ref = document.getElementById('dragstartzone');

        //         // Calculate normalized positions within the dragstartzone
        //         let normalizedX = event.offsetX - ref.offsetWidth / 2;  // Center x to 0
        //         let normalizedY = event.offsetY - ref.offsetHeight / 2; // Center y to 0

        //         // Ensure the joystick does not move out of the dragstartzone's boundaries
        //         normalizedX = Math.max(-ref.offsetWidth / 2, Math.min(normalizedX, ref.offsetWidth / 2));
        //         normalizedY = Math.max(-ref.offsetHeight / 2, Math.min(normalizedY, ref.offsetHeight / 2));

        //         // Update the dragCircle position
        //         this.dragCircleStyle.left = `${normalizedX + ref.offsetWidth / 2}px`;
        //         this.dragCircleStyle.top = `${normalizedY + ref.offsetHeight / 2}px`;

        //         // Set display properties and update the joystick values
        //         this.dragCircleStyle.display = 'inline-block';
        //         this.setJoystickVals(normalizedX, normalizedY);
        //     }
        // },
        // setJoystickVals(normalizedX, normalizedY) {
        //     let ref = document.getElementById('dragstartzone');
        //     this.joystick.vertical = -1 * (normalizedY / (ref.offsetHeight / 2));
        //     this.joystick.horizontal = (normalizedX / (ref.offsetWidth / 2));
        //     this.sendCommand(this.joystick.vertical, this.joystick.horizontal);
        // },


        resetJoystickVals() {
            this.joystick.vertical = 0
            this.joystick.horizontal = 0
            this.sendCommand(this.joystick.vertical, this.joystick.horizontal)
        },


        // methods for the waypoint buttons
        sendGoal: function(num) {
            let print_once_status = false
            let print_once_feedback = false
            let actionClient = new ROSLIB.ActionClient({
                ros : this.ros,
                serverName : '/tortoisebot_as',
                actionName : 'course_web_dev_ros/WaypointActionAction'
            })

            this.goal = new ROSLIB.Goal({
                actionClient : actionClient,
                goalMessage: {
                       position: {
                            x: this.waypoints[num].x,
                            y: this.waypoints[num].y,
                            z: this.waypoints[num].z
                       }
                }
            })

            this.goal.on('status', (status) => {
                this.action.status = status
                console.log(this.action.status.status)
                if (this.action.status.status ==1 && !print_once_status) {
                    this.logs.unshift('goal has been accepted by the server...')
                    this.logs.unshift('moving towards waypoint- '+ num)
                    print_once_status = true
                }
                else if (this.action.status.status ==0 && !print_once_status) {
                    this.logs.unshift('The requested goal is rejected by the server...')
                    print_once_status = true
                }
            })

            this.goal.on('feedback', (feedback) => {
                this.action.feedback = feedback
                if (this.action.feedback.state == 'The goal has been cancelled/preempted' && !print_once_feedback ) {
                    this.logs.unshift('The goal has been cancelled/preempted')
                    print_once_feedback = true
                }
            })

            this.goal.on('result', (result) => {
                this.action.result = result
                if (this.action.result.success == true) {
                    this.logs.unshift('Reached to the waypoint- ' + num)
                }
            })

            this.goal.send()
            this.logs.unshift('goal to the waypoint-' + num + ' sent to the server...')
            
        },
        cancelGoal: function() {
            this.goal.cancel()
            this.logs.unshift('Cancelling the Goal...')
        },


        // setup3DViewer() {
        //     this.viewer = new ROS3D.Viewer({
        //         background: '#cccccc',
        //         divID: 'div3DViewer',
        //         width: 400,
        //         height: 300,
        //         antialias: true,
        //         fixedFrame: 'odom'
        //     })

        //     // Add a grid.
        //     this.viewer.addObject(new ROS3D.Grid({
        //         color:'#0181c4',
        //         cellSize: 0.5,
        //         num_cells: 20
        //     }))

        //     // Setup a client to listen to TFs.
        //     this.tfClient = new ROSLIB.TFClient({
        //         ros: this.ros,
        //         angularThres: 0.01,
        //         transThres: 0.01,
        //         rate: 10.0
        //     })

        //     // Setup the URDF client.
        //     this.urdfClient = new ROS3D.UrdfClient({
        //         ros: this.ros,
        //         param: 'robot_description',
        //         tfClient: this.tfClient,
        //         // We use "path: location.origin + location.pathname"
        //         // instead of "path: window.location.href" to remove query params,
        //         // otherwise the assets fail to load
        //         path: location.origin + location.pathname,
        //         rootObject: this.viewer.scene,
        //         loader: ROS3D.COLLADA_LOADER_2
        //     })
        // },
        // unset3DViewer() {
        //     document.getElementById('div3DViewer').innerHTML = ''
        // },

      

    },
    mounted() {
        console.log("page is ready!")
        this.interval = setInterval(() => {
            if (this.ros != null && this.ros.isConnected) {
                this.ros.getNodes((data) => { }, (error) => { })
            }
        }, 10000)
        window.addEventListener('mouseup', this.stopDrag)
    },
})