import { createContext, useState, useEffect } from "react";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
	const [auth, setAuth] = useState(() => {
		try {
			const raw = localStorage.getItem("auth");
			return raw ? JSON.parse(raw) : {};
		} catch (e) {
			return {};
		}
	});

	useEffect(() => {
		if (auth && Object.keys(auth).length) {
			localStorage.setItem("auth", JSON.stringify(auth));
		} else {
			localStorage.removeItem("auth");
		}
	}, [auth]);

	return (
		<AuthContext.Provider value={{ auth, setAuth }}>
			{children}
		</AuthContext.Provider>
	);
};

export default AuthContext;
