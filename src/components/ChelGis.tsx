import React, { useState } from 'react';

const ChelGis: React.FC = () => {
    
    const [text, setText] = useState("Hello");

    return (
        <div>
            <h1>{text}</h1> {}
        </div>
    );
};

export default ChelGis;
