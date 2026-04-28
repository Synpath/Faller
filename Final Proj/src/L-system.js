import * as THREE from 'three'

class LSystem {

    constructor(axiom)
{
    this.axiom = axiom;
    this.currentSystem = "";
    this.rules = new Map(); //KEy: Character, Value: String
}

addRule(id, rule)
{
    this.rules.set(id, rule);
}

produce(iterations)
{

    this.currentSystem = this.axiom;

    for (let loop=1; loop <= iterations; loop++)
    {
        let tempResult = "";

        for (let charLoop=0; charLoop < this.currentSystem.length; charLoop++)
        {
            let nextChar = this.currentSystem.charAt(charLoop);
            if (this.rules.has(nextChar))
            {
                tempResult += this.rules.get(nextChar);
            }
            else
            {
                tempResult+= nextChar;
            }
        }

        this.currentSystem= tempResult;
    }
}

    draw(length, angleInDegrees)
    {
        let x = 0;
        let y = 0;
        let angle = angleInDegrees * (Math.PI / 180);
        let currentAngle = Math.PI / 2;
        const newShape = new THREE.Shape();
        const stack = [];

        for (let charLoop=0; charLoop < this.currentSystem.length; charLoop++)
        {
            let nextChar = this.currentSystem.charAt(charLoop);

            //println("$" + nextChar );
            switch (nextChar)
            {
                case 'G': // fall thru
                case 'F':
                    let newX = x + length * Math.cos(currentAngle);
                    let newY = y + length * Math.sin(currentAngle);
                    newShape.lineTo(newX, newY);

                    x = newX;
                    y = newY;
                    break;

                case '-':
                    currentAngle -= angle;
                    //println("turn: " + (-angle));
                    break;

                case '+':
                    currentAngle += angle;
                    //println("turn: " + (+angle));
                    break;
                case '[':
                    stack.push({x, y, currentAngle});
                    //println("push");
                    break;
                case ']':
                    const state = stack.pop();
                    x = state.x;
                    y = state.y;
                    currentAngle = state.currentAngle;
                    //println("pop");
                    break;

                default:
                //print("?" + nextChar);
            }
        } //for
        const geometry = new THREE.ExtrudeGeometry(newShape);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geometry, mat);

        return mesh;
    }
}
export{LSystem}