import * as THREE from 'three'

class LSystem {

    constructor(axiom)
    {
        this.axiom = axiom;
        this.currentSystem = "";
        this.rules = new Map(); //KEy: Character, Value: String
    }

    resetSystem(axiom) {
        this.currentSystem = "";
        this.rules = new Map();
        this.axiom = axiom;
    }

    addRule(id, rule)
    {
        this.rules.set(id, rule);
    }

    produce(iterations)
    {

        this.currentSystem = this.axiom;

        for (let i= 1; i <= iterations; i++)
        {
            let result = "";

            for (let j= 0; j < this.currentSystem.length; j++)
            {
                let nextChar = this.currentSystem.charAt(j);
                if (this.rules.has(nextChar))
                {
                    result += this.rules.get(nextChar);
                }
                else
                {
                    result += nextChar;
                }
            }

            this.currentSystem = result;
        }
    }

    draw(length, angleInDegrees, color)
    {
        let x = 0;
        let y = 0;
        let angle = angleInDegrees * (Math.PI / 180);
        let currentAngle = Math.PI / 2;
        const newShape = new THREE.Shape();
        const stack = [];

        for (let i= 0; i < this.currentSystem.length; i++)
        {
            let char = this.currentSystem.charAt(i);

            switch (char)
            {
                case 'F':
                    let newX = x + length * Math.cos(currentAngle);
                    let newY = y + length * Math.sin(currentAngle);
                    newShape.lineTo(newX, newY);

                    x = newX;
                    y = newY;
                    break;

                case '-':
                    currentAngle -= angle;
                    break;

                case '+':
                    currentAngle += angle;
                    break;
                case '[':
                    stack.push({x, y, currentAngle});
                    break;
                case ']':
                    const state = stack.pop();
                    x = state.x;
                    y = state.y;
                    currentAngle = state.currentAngle;
                    break;

                default:
            }
        }

        const geometry = new THREE.ExtrudeGeometry(newShape);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.rotation.y = Math.PI / 2;
        return mesh;
    }
}
export{LSystem}