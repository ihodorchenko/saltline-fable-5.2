// Saltline-specific flow constants, compass labels and radio lines.
// The game state machine consumes these; engine modules must not.

const Yi={introSeconds:3.5,retryIntroSeconds:1.3,interactRange:2.2,interactFacing:.45,cutSeconds:2.4,patrol:{gull:2,hound:1},waves:[{gull:3,hound:1},{gull:3,hound:2},{gull:4,hound:3}],maxAlive:9,spawnStagger:.85,spawnFar:18,pursuitEvery:7,pursuitMinAlive:4,pursuitExtra:5,titleSpeed:1.15,titleFov:50},jC=["NORTH","NORTH-EAST","EAST","SOUTH-EAST","SOUTH","SOUTH-WEST","WEST","NORTH-WEST"],_l={intro:"Breacher, this is Control. The Harbormaster holds the berth. Cut its three uplinks \u2014 yard, shed, quay.",contact:"It has seen you. Gulls fly, Hounds walk. Put them down.",cut:["One relay dark. It felt that \u2014 machines inbound.","Two dark. It is throwing everything it has left at you."],all:"All three dark. The boat is holding at the quay ladder, south end. Run.",low:"You are hit hard. Get behind steel and breathe.",done:"Breacher is aboard. Saltline is dark. Good work."};

export { Yi as flow, jC as compassNames, _l as radio };
