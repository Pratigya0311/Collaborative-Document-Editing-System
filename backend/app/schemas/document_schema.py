"""Marshmallow schemas for serialization and validation"""
from marshmallow import Schema, fields, validate, validates, ValidationError
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from ..models import Document, DocumentVersion, EditLog, User

class UserSchema(SQLAlchemyAutoSchema):
    """Schema for User model"""
    class Meta:
        model = User
        load_instance = True
        exclude = ('password_hash',)
    
    user_id = fields.Int(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

class DocumentSchema(SQLAlchemyAutoSchema):
    """Schema for Document model"""
    class Meta:
        model = Document
        load_instance = True
    
    doc_id = fields.Int(dump_only=True)
    title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    content = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    owner_name = fields.Str(dump_only=True)
    
    @validates('title')
    def validate_title(self, value):
        if not value.strip():
            raise ValidationError("Title cannot be empty")

class DocumentVersionSchema(SQLAlchemyAutoSchema):
    """Schema for DocumentVersion model"""
    class Meta:
        model = DocumentVersion
        load_instance = True
    
    version_id = fields.Int(dump_only=True)
    timestamp = fields.DateTime(dump_only=True)
    editor_name = fields.Str(dump_only=True)
    
    # Exclude full content for list views
    content = fields.Str(required=False)
    
    class DocumentVersionListSchema(Schema):
        """Schema for listing versions without full content"""
        version_id = fields.Int()
        doc_id = fields.Int()
        edited_by = fields.Int()
        editor_name = fields.Str()
        timestamp = fields.DateTime()
        version_number = fields.Int()
        change_summary = fields.Str()
        parent_version_id = fields.Int(allow_none=True)

class EditLogSchema(SQLAlchemyAutoSchema):
    """Schema for EditLog model"""
    class Meta:
        model = EditLog
        load_instance = True
    
    log_id = fields.Int(dump_only=True)
    timestamp = fields.DateTime(dump_only=True)
    user_name = fields.Str(dump_only=True)
    metadata = fields.Dict(allow_none=True)

class CreateDocumentRequest(Schema):
    """Request schema for creating a document"""
    title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    content = fields.Str(allow_none=True, missing='')

class UpdateDocumentRequest(Schema):
    """Request schema for updating a document"""
    title = fields.Str(validate=validate.Length(min=1, max=255), required=False)
    content = fields.Str(required=True)
    base_version_id = fields.Int(required=False, allow_none=True)
    change_summary = fields.Str(required=False, missing='')

class LoginRequest(Schema):
    """Request schema for login"""
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1))

class RegisterRequest(Schema):
    """Request schema for registration"""
    name = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))