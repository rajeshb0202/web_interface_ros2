var app = new Vue({
    el: '#app',
    // storing the state of the page
    data: {
        connected: false,
        ros: null,
        logs: [],
        loading: false,
        rosbridge_address: 'wss://i-09405a2d85d86dbd8.robotigniteacademy.com/4575e79a-8201-4432-959a-f1c77a317c6e/rosbridge/',
        port: '9090',
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
                this.setCamera()
            })
            this.ros.on('error', (error) => {
                this.logs.unshift((new Date()).toTimeString() + ` - Error: ${error}`)
            })
            this.ros.on('close', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Disconnected!')
                this.connected = false
                this.loading = false
                document.getElementById('divCamera').innerHTML = ''
            })
        },
        disconnect: function() {
            this.ros.close()
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
        },
    },
    mounted() {
        console.log("page is ready!")
    },
})