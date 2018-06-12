package rest

import (
	"auth/tools/errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mongodb/mongo-go-driver/core/topology"
	validator "gopkg.in/go-playground/validator.v8"
)

var alreadyExistError = gin.H{"error": "Already exist"}
var internalServerError = gin.H{"error": "Internal server error"}

// HandleError handle any error and output JSON
func HandleError(c *gin.Context, err interface{}) {
	if ve, ok := err.(validator.ValidationErrors); ok {
		handleValidationError(c, ve)
		return
	}

	customError, ok := err.(errors.GinError)
	if ok {
		customError.Handle(c)
		return
	}

	if err == topology.ErrServerSelectionTimeout {
		c.JSON(500, internalServerError)
		return
	}

	simpleError, ok := err.(error)
	if ok {
		if IsUniqueKeyError(simpleError) {
			c.JSON(400, alreadyExistError)

		} else {
			c.JSON(500, gin.H{
				"error": simpleError.Error(),
			})
		}
		return
	}

	c.JSON(500, internalServerError)
}

// IsDuplicateKeyError retorna true si el error es de indice unico
func IsUniqueKeyError(err error) bool {
	return strings.Contains(err.Error(), "duplicate key error")
}

func handleValidationError(c *gin.Context, validationErrors validator.ValidationErrors) {
	var result []pathMessage

	for _, err := range validationErrors {
		result = append(result, pathMessage{
			Path:    strings.ToLower(err.Field),
			Message: err.Tag,
		})
	}

	c.JSON(400, gin.H{
		"messages": result,
	})
}

type pathMessage struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}